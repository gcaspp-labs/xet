package helpdesk

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// lockTicketsOfContact locks every open and pending ticket of the contact, in
// the order of the closing and of the registration: the open ones before the
// contact, the pending ones after them. Every one of them is announced when
// the contact changes, because each one shows the contact.
func lockTicketsOfContact(ctx context.Context, q *db.Queries, contactID int64) (open, pending []db.Ticket, err error) {
	open, err = db.AsTickets(q.GetOpenTicketsOfContactForUpdate(ctx, contactID))
	if err != nil {
		return nil, nil, fmt.Errorf("lock open tickets: %w", err)
	}
	pending, err = db.AsTickets(q.GetPendingTicketsOfContactForUpdate(ctx, contactID))
	if err != nil {
		return nil, nil, fmt.Errorf("lock pending tickets: %w", err)
	}
	return open, pending, nil
}

// announceTickets tells the sectors the tickets of the contact changed.
func (s *Service) announceTickets(open, pending []db.Ticket) {
	for _, t := range open {
		s.hub.Publish(realtime.TicketChanged(t.SectorID, t.ID))
	}
	for _, t := range pending {
		s.hub.Publish(realtime.TicketChanged(t.SectorID, t.ID))
	}
}

// RegisterContact saves the contact through the registration form and gives
// its organization to the open tickets of the contact that have none yet,
// such as the ticket of an unknown number (spec.md, Órgãos e contatos).
// Tickets that already have an organization keep it. The open tickets are
// locked before the contact, in the same order as the closing, so the two
// never wait on each other, and the pending ones after them. Every open and
// pending ticket is announced, because each one shows the contact; the
// pending ones only get the announcement: a pending ticket takes the
// organization of the contact when it is resumed.
func (s *Service) RegisterContact(ctx context.Context, actor auth.User, contactID int64, in directory.ContactInput) (directory.Contact, error) {
	var (
		contact directory.Contact
		open    []db.Ticket
		pending []db.Ticket
	)
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var err error
		open, pending, err = lockTicketsOfContact(ctx, q, contactID)
		if err != nil {
			return err
		}
		contact, err = directory.UpdateContact(ctx, q, actor, contactID, in)
		if err != nil {
			return err
		}
		for _, t := range open {
			if t.OrganizationID != nil {
				continue
			}
			updated, err := db.AsTicket(q.SetTicketOrganization(ctx, db.SetTicketOrganizationParams{ID: t.ID, OrganizationID: contact.OrganizationID}))
			if err != nil {
				return fmt.Errorf("set ticket organization: %w", err)
			}
			changes := audit.Changes{}
			changes.Set("organization_id", t.OrganizationID, updated.OrganizationID)
			if err := recordTicket(ctx, q, t.ID, "ticket_organization_linked", actor.ID, changes); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return directory.Contact{}, err
	}
	s.announceTickets(open, pending)
	return contact, nil
}

// SaveContactName saves only the name of an unregistered contact and announces
// its open and pending tickets, which show the name. The open tickets are
// locked before the contact, as in RegisterContact.
func (s *Service) SaveContactName(ctx context.Context, contactID int64, name string) (directory.Contact, error) {
	var (
		contact directory.Contact
		open    []db.Ticket
		pending []db.Ticket
	)
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var err error
		open, pending, err = lockTicketsOfContact(ctx, q, contactID)
		if err != nil {
			return err
		}
		contact, err = directory.SetContactName(ctx, q, contactID, name)
		return err
	})
	if err != nil {
		return directory.Contact{}, err
	}
	s.announceTickets(open, pending)
	return contact, nil
}
