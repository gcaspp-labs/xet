// Package directory manages the people served (contacts) and the
// organizations they belong to.
package directory

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/audit"
	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// MaxResults caps each search; the user refines the query to find others.
const MaxResults = 50

var (
	ErrInvalidName          = errors.New("invalid name")
	ErrInvalidPhone         = errors.New("invalid phone")
	ErrInvalidCNPJ          = errors.New("invalid cnpj")
	ErrCNPJTaken            = errors.New("cnpj already in use")
	ErrPhoneTaken           = errors.New("phone already in use")
	ErrOrganizationNotFound = errors.New("organization not found")
	ErrOrganizationRequired = errors.New("organization required")
	ErrContactNotFound      = errors.New("contact not found")
	ErrSectorRequired       = errors.New("sector required")
	ErrInvalidSector        = errors.New("invalid sector")
	ErrSectorNotAllowed     = errors.New("sector not allowed")
	ErrInvalidModules       = errors.New("invalid modules")
)

var phonePattern = regexp.MustCompile(`^[0-9]{10,15}$`)

// phoneFormatting is stripped so "+55 (11) 99999-0000" is stored as digits.
var phoneFormatting = strings.NewReplacer(" ", "", "(", "", ")", "", "-", "", "+", "", ".", "")

// cnpjFormatting is stripped so "12.ABC.345/01DE-35" is stored as 12ABC34501DE35.
var cnpjFormatting = strings.NewReplacer(" ", "", ".", "", "/", "", "-", "")

var cnpjPattern = regexp.MustCompile(`^[0-9A-Z]{12}[0-9]{2}$`)

// NormalizeCNPJ removes the formatting, upper-cases the letters and checks
// the format and check digits. It accepts the numeric CNPJ and the
// alphanumeric one issued since July 2026 (modelo-dados.md).
func NormalizeCNPJ(raw string) (string, error) {
	cnpj := strings.ToUpper(cnpjFormatting.Replace(raw))
	if !cnpjPattern.MatchString(cnpj) || strings.Count(cnpj, cnpj[:1]) == len(cnpj) {
		return "", ErrInvalidCNPJ
	}
	if cnpjCheckDigit(cnpj[:12]) != cnpj[12] || cnpjCheckDigit(cnpj[:13]) != cnpj[13] {
		return "", ErrInvalidCNPJ
	}
	return cnpj, nil
}

// cnpjCheckDigit is the modulo 11 check digit of the prefix, with weights
// 2 to 9 from right to left and each character worth its ASCII code minus 48.
func cnpjCheckDigit(prefix string) byte {
	sum, weight := 0, 2
	for i := len(prefix) - 1; i >= 0; i-- {
		sum += int(prefix[i]-'0') * weight
		weight++
		if weight > 9 {
			weight = 2
		}
	}
	rest := sum % 11
	if rest < 2 {
		return '0'
	}
	return byte('0' + 11 - rest)
}

type Service struct {
	pool *pgxpool.Pool
	q    *db.Queries
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool, q: db.New(pool)}
}

// OrganizationInput holds the editable fields of an organization. An empty
// CNPJ means the organization has none.
type OrganizationInput struct {
	Name string
	CNPJ string
}

func (in OrganizationInput) normalize() (string, *string, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return "", nil, ErrInvalidName
	}
	if strings.TrimSpace(in.CNPJ) == "" {
		return name, nil, nil
	}
	cnpj, err := NormalizeCNPJ(in.CNPJ)
	if err != nil {
		return "", nil, err
	}
	return name, &cnpj, nil
}

// searchPatterns builds the LIKE patterns of a search: the name pattern
// matches anywhere in the name; the phone and CNPJ patterns are set only
// when the query, without formatting, could be part of a phone or a CNPJ.
type searchPatterns struct {
	name, phone, cnpj string
}

func newSearchPatterns(query string) searchPatterns {
	query = strings.TrimSpace(query)
	if query == "" {
		return searchPatterns{}
	}
	p := searchPatterns{name: "%" + escapeLike(query) + "%"}
	if digits := phoneFormatting.Replace(query); isDigits(digits) {
		p.phone = "%" + digits + "%"
	}
	// A CNPJ fragment has at least one digit, so plain words do not match
	// the letters of alphanumeric CNPJs.
	if cnpj := strings.ToUpper(cnpjFormatting.Replace(query)); isCNPJFragment(cnpj) {
		p.cnpj = "%" + cnpj + "%"
	}
	return p
}

func escapeLike(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func isDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func isCNPJFragment(s string) bool {
	hasDigit := false
	for _, r := range s {
		switch {
		case r >= '0' && r <= '9':
			hasDigit = true
		case r >= 'A' && r <= 'Z':
		default:
			return false
		}
	}
	return hasDigit
}

// SearchOrganizations finds organizations by name or CNPJ; an empty query
// lists them by name.
func (s *Service) SearchOrganizations(ctx context.Context, query string) ([]db.Organization, error) {
	p := newSearchPatterns(query)
	orgs, err := s.q.SearchOrganizations(ctx, db.SearchOrganizationsParams{
		NamePattern: p.name,
		CnpjPattern: p.cnpj,
		MaxResults:  MaxResults,
	})
	if err != nil {
		return nil, fmt.Errorf("search organizations: %w", err)
	}
	return orgs, nil
}

// CreateOrganization registers an organization and its audit log in one transaction.
func (s *Service) CreateOrganization(ctx context.Context, actorID int64, in OrganizationInput) (db.Organization, error) {
	name, cnpj, err := in.normalize()
	if err != nil {
		return db.Organization{}, err
	}

	var org db.Organization
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		org, err = q.CreateOrganization(ctx, db.CreateOrganizationParams{Name: name, Cnpj: cnpj})
		if err != nil {
			return constraintError("create organization", err)
		}
		changes := audit.Changes{}
		changes.Set("name", nil, org.Name)
		changes.Set("cnpj", nil, org.Cnpj)
		return record(ctx, q, org.ID, "organization_created", actorID, changes)
	})
	if err != nil {
		return db.Organization{}, err
	}
	return org, nil
}

// UpdateOrganization changes the name and CNPJ of an organization, locking
// its row and recording what changed in the same transaction.
func (s *Service) UpdateOrganization(ctx context.Context, actorID, id int64, in OrganizationInput) (db.Organization, error) {
	name, cnpj, err := in.normalize()
	if err != nil {
		return db.Organization{}, err
	}

	var org db.Organization
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		before, err := q.GetOrganizationForUpdate(ctx, id)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrOrganizationNotFound
		}
		if err != nil {
			return fmt.Errorf("get organization: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("name", before.Name, name)
		changes.Set("cnpj", before.Cnpj, cnpj)
		if changes.Empty() {
			org = before
			return nil
		}
		org, err = q.UpdateOrganization(ctx, db.UpdateOrganizationParams{ID: id, Name: name, Cnpj: cnpj})
		if err != nil {
			return constraintError("update organization", err)
		}
		return record(ctx, q, id, "organization_updated", actorID, changes)
	})
	if err != nil {
		return db.Organization{}, err
	}
	return org, nil
}

// Contact is a contact with its main organization, sectors and modules.
type Contact struct {
	db.Contact
	OrganizationName *string
	OrganizationCNPJ *string
	Sectors          []db.ListSectorsOfContactsRow
	Modules          []db.ListModulesOfContactsRow
}

// ContactInput holds the fields of the contact registration form.
type ContactInput struct {
	Name           string
	Phone          string
	OrganizationID int64
	SectorIDs      []int64
	ModuleIDs      []int64
}

func (in ContactInput) normalize() (ContactInput, error) {
	in.Name = strings.TrimSpace(in.Name)
	in.Phone = phoneFormatting.Replace(in.Phone)
	if in.Name == "" {
		return in, ErrInvalidName
	}
	if !phonePattern.MatchString(in.Phone) {
		return in, ErrInvalidPhone
	}
	if in.OrganizationID == 0 {
		return in, ErrOrganizationRequired
	}
	in.SectorIDs = sortedIDs(in.SectorIDs)
	in.ModuleIDs = sortedIDs(in.ModuleIDs)
	return in, nil
}

func sortedIDs(ids []int64) []int64 {
	ids = slices.Clone(ids)
	slices.Sort(ids)
	return slices.Compact(ids)
}

// ContactFilter narrows the contact search; a zero sector or module means all.
type ContactFilter struct {
	Query    string
	SectorID int64
	ModuleID int64
}

// SearchContacts finds contacts by contact or organization name, phone or
// organization CNPJ, in the sector and module of the filter; an empty query
// lists them by name.
func (s *Service) SearchContacts(ctx context.Context, filter ContactFilter) ([]Contact, error) {
	p := newSearchPatterns(filter.Query)
	rows, err := s.q.SearchContacts(ctx, db.SearchContactsParams{
		NamePattern:  p.name,
		PhonePattern: p.phone,
		CnpjPattern:  p.cnpj,
		SectorID:     filter.SectorID,
		ModuleID:     filter.ModuleID,
		MaxResults:   MaxResults,
	})
	if err != nil {
		return nil, fmt.Errorf("search contacts: %w", err)
	}
	out := make([]Contact, len(rows))
	for i, r := range rows {
		out[i] = Contact{Contact: r.Contact, OrganizationName: r.OrganizationName, OrganizationCNPJ: r.OrganizationCnpj}
	}
	if err := loadLinks(ctx, s.q, out); err != nil {
		return nil, err
	}
	return out, nil
}

// GetContact returns the contact with its organization, sectors and modules.
func (s *Service) GetContact(ctx context.Context, id int64) (Contact, error) {
	return getContact(ctx, s.q, id)
}

// CreateContact registers a contact linked to an existing organization, with
// its sectors and modules.
func (s *Service) CreateContact(ctx context.Context, actor auth.User, in ContactInput) (Contact, error) {
	in, err := in.normalize()
	if err != nil {
		return Contact{}, err
	}

	var contact Contact
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		c, err := q.CreateContact(ctx, db.CreateContactParams{Name: in.Name, Phone: &in.Phone, OrganizationID: &in.OrganizationID})
		if err != nil {
			return constraintError("create contact", err)
		}
		if err := saveLinks(ctx, q, actor, c.ID, in); err != nil {
			return err
		}
		contact, err = getContact(ctx, q, c.ID)
		return err
	})
	if err != nil {
		return Contact{}, err
	}
	return contact, nil
}

// UpdateContact changes the contact data, sectors and modules and marks it as
// registered, inside the caller's transaction, so the ticket domain can
// complete the open tickets of the contact in the same commit.
func UpdateContact(ctx context.Context, q *db.Queries, actor auth.User, id int64, in ContactInput) (Contact, error) {
	in, err := in.normalize()
	if err != nil {
		return Contact{}, err
	}
	_, err = q.UpdateContact(ctx, db.UpdateContactParams{ID: id, Name: in.Name, Phone: &in.Phone, OrganizationID: &in.OrganizationID})
	if errors.Is(err, pgx.ErrNoRows) {
		return Contact{}, ErrContactNotFound
	}
	if err != nil {
		return Contact{}, constraintError("update contact", err)
	}
	if err := saveLinks(ctx, q, actor, id, in); err != nil {
		return Contact{}, err
	}
	return getContact(ctx, q, id)
}

// saveLinks applies the sectors and modules of the form. The actor changes
// only the sectors it can access, and the modules of those sectors; the other
// links are kept as they are, whatever the form says (spec.md, Setores e
// módulos do contato). Only what the form changed is written, so a sector the
// contact has just entered by a message is not lost.
func saveLinks(ctx context.Context, q *db.Queries, actor auth.User, contactID int64, in ContactInput) error {
	sectors, err := q.ListSectorsOfContacts(ctx, []int64{contactID})
	if err != nil {
		return fmt.Errorf("list contact sectors: %w", err)
	}
	var kept, removed []int64
	for _, sec := range sectors {
		if slices.Contains(in.SectorIDs, sec.ID) || !actor.CanAccessSector(sec.ID) {
			kept = append(kept, sec.ID)
		} else {
			removed = append(removed, sec.ID)
		}
	}
	var added []int64
	for _, id := range in.SectorIDs {
		if slices.Contains(kept, id) {
			continue
		}
		if !actor.CanAccessSector(id) {
			return ErrSectorNotAllowed
		}
		added = append(added, id)
	}
	if len(kept)+len(added) == 0 {
		return ErrSectorRequired
	}
	active, err := q.ListActiveSectorIDs(ctx, added)
	if err != nil {
		return fmt.Errorf("list active sectors: %w", err)
	}
	if len(active) != len(added) {
		return ErrInvalidSector
	}
	if err := q.RemoveContactSectors(ctx, db.RemoveContactSectorsParams{ContactID: contactID, SectorIds: removed}); err != nil {
		return fmt.Errorf("remove contact sectors: %w", err)
	}
	if err := q.AddContactSectors(ctx, db.AddContactSectorsParams{ContactID: contactID, SectorIds: added}); err != nil {
		return fmt.Errorf("add contact sectors: %w", err)
	}
	return saveModules(ctx, q, actor, contactID, slices.Concat(kept, added), in.ModuleIDs)
}

// saveModules applies the modules of the form, which must belong to the
// sectors of the contact. A new module must be active; one already linked may
// stay after being deactivated. Modules of a sector the contact left go away.
func saveModules(ctx context.Context, q *db.Queries, actor auth.User, contactID int64, sectorIDs, moduleIDs []int64) error {
	current, err := q.ListModulesOfContacts(ctx, []int64{contactID})
	if err != nil {
		return fmt.Errorf("list contact modules: %w", err)
	}
	linked := func(id int64) bool {
		return slices.ContainsFunc(current, func(m db.ListModulesOfContactsRow) bool { return m.ID == id })
	}
	requested, err := q.GetModulesForShare(ctx, moduleIDs)
	if err != nil {
		return fmt.Errorf("get modules: %w", err)
	}
	if len(requested) != len(moduleIDs) {
		return ErrInvalidModules
	}
	var added []int64
	for _, m := range requested {
		if !slices.Contains(sectorIDs, m.SectorID) {
			return ErrInvalidModules
		}
		if linked(m.ID) {
			continue
		}
		if !actor.CanAccessSector(m.SectorID) {
			return ErrSectorNotAllowed
		}
		if !m.Active {
			return ErrInvalidModules
		}
		added = append(added, m.ID)
	}
	var removed []int64
	for _, m := range current {
		inSector := slices.Contains(sectorIDs, m.SectorID)
		if !inSector || (actor.CanAccessSector(m.SectorID) && !slices.Contains(moduleIDs, m.ID)) {
			removed = append(removed, m.ID)
		}
	}
	if err := q.RemoveContactModules(ctx, db.RemoveContactModulesParams{ContactID: contactID, ModuleIds: removed}); err != nil {
		return fmt.Errorf("remove contact modules: %w", err)
	}
	if err := q.AddContactModules(ctx, db.AddContactModulesParams{ContactID: contactID, ModuleIds: added}); err != nil {
		return fmt.Errorf("add contact modules: %w", err)
	}
	return nil
}

func getContact(ctx context.Context, q *db.Queries, id int64) (Contact, error) {
	r, err := q.GetContactWithOrganization(ctx, id)
	if errors.Is(err, pgx.ErrNoRows) {
		return Contact{}, ErrContactNotFound
	}
	if err != nil {
		return Contact{}, fmt.Errorf("get contact: %w", err)
	}
	out := []Contact{{Contact: r.Contact, OrganizationName: r.OrganizationName, OrganizationCNPJ: r.OrganizationCnpj}}
	if err := loadLinks(ctx, q, out); err != nil {
		return Contact{}, err
	}
	return out[0], nil
}

// loadLinks fills the sectors and modules of the contacts.
func loadLinks(ctx context.Context, q *db.Queries, contacts []Contact) error {
	ids := make([]int64, len(contacts))
	index := make(map[int64]*Contact, len(contacts))
	for i := range contacts {
		ids[i] = contacts[i].ID
		index[ids[i]] = &contacts[i]
	}
	sectors, err := q.ListSectorsOfContacts(ctx, ids)
	if err != nil {
		return fmt.Errorf("list contact sectors: %w", err)
	}
	for _, sec := range sectors {
		c := index[sec.ContactID]
		c.Sectors = append(c.Sectors, sec)
	}
	modules, err := q.ListModulesOfContacts(ctx, ids)
	if err != nil {
		return fmt.Errorf("list contact modules: %w", err)
	}
	for _, m := range modules {
		c := index[m.ContactID]
		c.Modules = append(c.Modules, m)
	}
	return nil
}

func record(ctx context.Context, q *db.Queries, orgID int64, action string, actorID int64, changes audit.Changes) error {
	raw, err := changes.JSON()
	if err != nil {
		return err
	}
	if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
		EntityType: "organization",
		EntityID:   orgID,
		Action:     action,
		ActorID:    &actorID,
		Changes:    raw,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return nil
}

// constraintError converts constraint violations into domain errors.
func constraintError(op string, err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.ConstraintName {
		case "organizations_cnpj_key":
			return ErrCNPJTaken
		case "organizations_cnpj_check":
			return ErrInvalidCNPJ
		case "contacts_phone_key":
			return ErrPhoneTaken
		case "contacts_phone_check":
			return ErrInvalidPhone
		case "contacts_organization_id_fkey":
			return ErrOrganizationNotFound
		case "contacts_registered_organization":
			return ErrOrganizationRequired
		case "organizations_name_check", "contacts_name_check":
			return ErrInvalidName
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}
