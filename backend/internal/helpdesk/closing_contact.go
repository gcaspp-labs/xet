package helpdesk

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// lockContact locks the contact for share inside the caller's transaction, so
// its registration does not change until the commit. The contact is locked
// after the ticket, in the order every action follows. The missing contact
// keeps the pgx error, so each flow answers it as it did before: the phone
// registration refuses it as unknown, and the closing keeps it as an internal
// error.
func lockContact(ctx context.Context, q *db.Queries, contactID int64) (db.Contact, error) {
	contact, err := q.GetContactForShare(ctx, contactID)
	if err != nil {
		return contact, fmt.Errorf("lock contact: %w", err)
	}
	return contact, nil
}

// lockClosingContact locks the contact and checks the two rules the closing
// and the phone registration share, in this order: the contact is registered
// and, only then, the organization exists. A missing contact is refused before
// the organization is consulted. Marking pending and transferring to another
// sector keep only the lock: they do not require a registered contact.
func lockClosingContact(ctx context.Context, q *db.Queries, contactID, organizationID int64) error {
	contact, err := lockContact(ctx, q, contactID)
	if err != nil {
		return err
	}
	if !contact.Registered {
		return ErrContactNotRegistered
	}
	if _, err := q.GetOrganization(ctx, organizationID); errors.Is(err, pgx.ErrNoRows) {
		return ErrInvalidOrganization
	} else if err != nil {
		return fmt.Errorf("get organization: %w", err)
	}
	return nil
}
