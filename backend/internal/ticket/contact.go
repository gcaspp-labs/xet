package ticket

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
)

// RegisterContact saves the contact through the registration form and gives
// its organization to the open tickets of the contact that have none yet,
// such as the ticket of an unknown number (spec.md, Órgãos e contatos).
// Tickets that already have an organization keep it. The open tickets are
// locked before the contact, in the same order as the closing, so the two
// never wait on each other.
func (s *Service) RegisterContact(ctx context.Context, actor auth.User, contactID int64, in directory.ContactInput) (directory.Contact, error) {
	var (
		contact directory.Contact
		linked  []db.Ticket
	)
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		open, err := q.GetOpenTicketsOfContactForUpdate(ctx, contactID)
		if err != nil {
			return fmt.Errorf("lock open tickets: %w", err)
		}
		contact, err = directory.UpdateContact(ctx, q, actor, contactID, in)
		if err != nil {
			return err
		}
		for _, t := range open {
			if t.OrganizationID != nil {
				continue
			}
			updated, err := q.SetTicketOrganization(ctx, db.SetTicketOrganizationParams{ID: t.ID, OrganizationID: contact.OrganizationID})
			if err != nil {
				return fmt.Errorf("set ticket organization: %w", err)
			}
			changes := audit.Changes{}
			changes.Set("organization_id", t.OrganizationID, updated.OrganizationID)
			if err := recordTicket(ctx, q, t.ID, "ticket_organization_linked", actor.ID, changes); err != nil {
				return err
			}
			linked = append(linked, updated)
		}
		return nil
	})
	if err != nil {
		return directory.Contact{}, err
	}
	for _, t := range linked {
		s.hub.Publish(realtime.TicketChanged(t.SectorID, t.ID))
	}
	return contact, nil
}
