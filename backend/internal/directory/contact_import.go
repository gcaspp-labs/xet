package directory

import (
	"cmp"
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

// ImportInput holds the chosen phones and the optional organization of the
// batch; zero means none.
type ImportInput struct {
	Phones         []string
	OrganizationID int64
}

// ImportResult counts what happened to the chosen phones. Unavailable are
// those that left the address book after the list was shown.
type ImportResult struct {
	Created     int
	Existing    int
	Unavailable int
}

// BookEntry is someone who can be imported. Exists reports a contact with this
// phone or its variant, which the import keeps as it is.
type BookEntry struct {
	messaging.SavedContact
	Exists bool
}

// ListSavedContacts lists the address book of the sector number, saying who is
// already a contact.
func (s *Service) ListSavedContacts(ctx context.Context, provider messaging.Provider, sectorID int64) ([]BookEntry, error) {
	saved, err := savedContacts(ctx, provider, sectorID)
	if err != nil {
		return nil, err
	}
	var phones []string
	for _, c := range saved {
		phones = append(phones, PhoneVariants(c.Phone)...)
	}
	rows, err := s.q.ListExistingPhones(ctx, phones)
	if err != nil {
		return nil, fmt.Errorf("list existing phones: %w", err)
	}
	existing := make(map[string]bool, len(rows))
	for _, phone := range rows {
		existing[phone] = true
	}
	out := make([]BookEntry, len(saved))
	for i, c := range saved {
		exists := slices.ContainsFunc(PhoneVariants(c.Phone), func(phone string) bool { return existing[phone] })
		out[i] = BookEntry{SavedContact: c, Exists: exists}
	}
	return out, nil
}

// savedContacts reads who can be imported from the sector number: only who has
// a saved name and a phone, by name.
func savedContacts(ctx context.Context, provider messaging.Provider, sectorID int64) ([]messaging.SavedContact, error) {
	book, ok := provider.(messaging.ContactBook)
	if !ok {
		return nil, ErrNoContactBook
	}
	saved, err := book.SavedContacts(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("read address book: %w", err)
	}
	slices.SortFunc(saved, func(a, b messaging.SavedContact) int {
		return cmp.Or(cmp.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)), cmp.Compare(a.Phone, b.Phone))
	})
	out := make([]messaging.SavedContact, 0, len(saved))
	// The same person may come twice, by phone and by LID.
	seen := make(map[string]bool, len(saved))
	for _, c := range saved {
		c.Name = strings.TrimSpace(c.Name)
		if c.Name != "" && phonePattern.MatchString(c.Phone) && !seen[c.Phone] {
			seen[c.Phone] = true
			out = append(out, c)
		}
	}
	return out, nil
}

// ImportContacts creates the chosen contacts of the address book and links them
// to the sector, in one transaction. The names are read again here, never taken
// from the client. A phone that already exists, with or without the Brazilian
// ninth digit, is kept as it is and only gets the link (spec.md, Importar
// contatos do WhatsApp).
func (s *Service) ImportContacts(ctx context.Context, provider messaging.Provider, actor auth.User, sectorID int64, in ImportInput) (ImportResult, error) {
	phones := sortedPhones(in.Phones)
	if len(phones) == 0 {
		return ImportResult{}, ErrNoContactsChosen
	}
	saved, err := savedContacts(ctx, provider, sectorID)
	if err != nil {
		return ImportResult{}, err
	}
	names := make(map[string]string, len(saved))
	for _, c := range saved {
		names[c.Phone] = c.Name
	}

	var organizationID *int64
	if in.OrganizationID != 0 {
		organizationID = &in.OrganizationID
	}
	var result ImportResult
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		result = ImportResult{}
		if organizationID != nil {
			if _, err := q.GetOrganization(ctx, *organizationID); errors.Is(err, pgx.ErrNoRows) {
				return ErrOrganizationNotFound
			} else if err != nil {
				return fmt.Errorf("get organization: %w", err)
			}
		}
		// In the order of the phone locks, so concurrent imports wait for each
		// other instead of deadlocking.
		for _, phone := range phones {
			name, ok := names[phone]
			if !ok {
				result.Unavailable++
				continue
			}
			id, created, err := findOrImportContact(ctx, q, name, phone, organizationID)
			if err != nil {
				return err
			}
			if created {
				result.Created++
			} else {
				result.Existing++
			}
			if err := LinkSector(ctx, q, id, sectorID, &actor.ID); err != nil {
				return err
			}
		}
		return recordImport(ctx, q, sectorID, actor.ID, result)
	})
	if err != nil {
		return ImportResult{}, err
	}
	return result, nil
}

func sortedPhones(phones []string) []string {
	phones = slices.Clone(phones)
	slices.SortFunc(phones, func(a, b string) int {
		return cmp.Or(cmp.Compare(phoneKey(a), phoneKey(b)), cmp.Compare(a, b))
	})
	return slices.Compact(phones)
}

// findOrImportContact returns the contact of the phone or its variant,
// creating it when there is none. It is registered only with an organization.
func findOrImportContact(ctx context.Context, q *db.Queries, name, phone string, organizationID *int64) (id int64, created bool, err error) {
	if err := LockPhone(ctx, q, phone); err != nil {
		return 0, false, err
	}
	for attempt := 0; attempt < 2; attempt++ {
		contact, err := q.GetContactByPhone(ctx, PhoneVariants(phone))
		if err == nil {
			return contact.ID, false, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, false, fmt.Errorf("get contact by phone: %w", err)
		}
		contact, err = q.CreateImportedContact(ctx, db.CreateImportedContactParams{
			Name: name, Phone: &phone, OrganizationID: organizationID, Registered: organizationID != nil,
		})
		if err == nil {
			return contact.ID, true, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return 0, false, constraintError("import contact", err)
		}
		// A concurrent import or message created the contact first; look it up again.
	}
	return 0, false, fmt.Errorf("contact %s could not be imported", phone)
}

func recordImport(ctx context.Context, q *db.Queries, sectorID, actorID int64, result ImportResult) error {
	raw, err := audit.Changes{
		"created":  {From: nil, To: result.Created},
		"existing": {From: nil, To: result.Existing},
	}.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: "sector",
		EntityID:   sectorID,
		Action:     "contacts_imported",
		ActorID:    &actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}
