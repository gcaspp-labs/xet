package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// MarkPending sets the ticket in progress aside, with a reason, while it
// depends on something else (spec #332). Only the assignee marks it;
// supervisors and admins are no exception, as in the closing. The ticket
// leaves its assignee, who is kept as who marked it, and nothing goes to the
// customer.
//
// The ticket is locked as a received message locks it: a message waiting on
// the lock finds it pending after the commit and opens a queued ticket, so a
// pending ticket never takes a new message. The contact is locked for share
// after the ticket, in the order of the closing.
func (s *Service) MarkPending(ctx context.Context, actor auth.User, ticketID int64, reason string) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return db.Ticket{}, ErrReasonRequired
	}

	var ticket db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := db.AsTicket(q.GetTicketForUpdate(ctx, ticketID))
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if t.Status == db.TicketStatusQueued {
			return ErrNotInProgress
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		if _, err := q.GetContactForShare(ctx, t.ContactID); err != nil {
			return fmt.Errorf("lock contact: %w", err)
		}

		ticket, err = db.AsTicket(q.MarkTicketPending(ctx, db.MarkTicketPendingParams{
			ID: t.ID, PendingReason: &reason, PendingByID: &actor.ID,
		}))
		if err != nil {
			return fmt.Errorf("mark ticket pending: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("status", string(t.Status), string(ticket.Status))
		changes.Set("assignee_id", t.AssigneeID, ticket.AssigneeID)
		raw, err := changes.JSON()
		if err != nil {
			return err
		}
		if err := q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			TicketID:   &ticket.ID,
			EntityType: "ticket",
			EntityID:   ticket.ID,
			Action:     "ticket_pending",
			ActorID:    &actor.ID,
			Reason:     &reason,
			Changes:    raw,
		}); err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// ListPending returns the pending tickets of the sector, the ones pending for
// longer first, with the contact, the organization and who marked it (#334).
// The caller checks the access to the sector: the sector's own, or any one for
// the admin.
func (s *Service) ListPending(ctx context.Context, sectorID int64) ([]db.ListPendingTicketsRow, error) {
	rows, err := s.q.ListPendingTickets(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list pending tickets: %w", err)
	}
	return rows, nil
}

// Resume brings a pending ticket back to attendance, with the user as
// assignee (#334). Anyone who may take a ticket of the queue resumes, in their
// own sector (the admin, in any). While the contact has a ticket in the queue
// or in progress in the sector, the resume is refused with that ticket's
// protocol and assignee, and nothing changes: a new message only goes to a
// ticket in the queue or in progress.
//
// The ticket is locked as in the marking, and the contact after it, in the
// order of the closing. The update to in_progress goes through the same unique
// index of one open ticket per contact and sector as the receiving: a message
// that opens a ticket of the contact meanwhile wins, and the index refuses the
// resume, which then answers with the open ticket.
func (s *Service) Resume(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}

	var ticket db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := db.AsTicket(q.GetTicketForUpdate(ctx, ticketID))
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		switch t.Status {
		case db.TicketStatusClosed:
			return ErrClosed
		case db.TicketStatusQueued:
			return ErrNotPending
		case db.TicketStatusInProgress:
			// A repeated click of whoever resumed it changes nothing, as in
			// the assignment.
			if t.AssigneeID != nil && *t.AssigneeID == actor.ID {
				ticket = t
				return nil
			}
			return ErrAlreadyAssigned
		}

		// The contact is locked after the ticket, in the order of the closing,
		// so the registration of the contact never waits on this one.
		contact, err := q.GetContactForShare(ctx, t.ContactID)
		if err != nil {
			return fmt.Errorf("lock contact: %w", err)
		}
		open, err := q.GetOpenTicketOfContactInSector(ctx, db.GetOpenTicketOfContactInSectorParams{
			SectorID: t.SectorID, ContactID: t.ContactID,
		})
		if err == nil {
			return &OpenTicketError{Protocol: open.Protocol, AssigneeName: open.AssigneeName}
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("get open ticket of the contact: %w", err)
		}

		ticket, err = db.AsTicket(q.ResumeTicket(ctx, db.ResumeTicketParams{ID: t.ID, AssigneeID: &actor.ID}))
		if err != nil {
			return fmt.Errorf("resume ticket: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("status", string(t.Status), string(ticket.Status))
		changes.Set("assignee_id", t.AssigneeID, ticket.AssigneeID)
		if err := recordTicket(ctx, q, ticket.ID, "ticket_resumed", actor.ID, changes); err != nil {
			return err
		}
		// The organization of the contact registered while the ticket was
		// pending arrives now, as it would when a new message opens a ticket.
		if t.OrganizationID != nil || contact.OrganizationID == nil {
			return nil
		}
		updated, err := db.AsTicket(q.SetTicketOrganization(ctx, db.SetTicketOrganizationParams{
			ID: t.ID, OrganizationID: contact.OrganizationID,
		}))
		if err != nil {
			return fmt.Errorf("set ticket organization: %w", err)
		}
		ticket = updated
		linked := audit.Changes{}
		linked.Set("organization_id", t.OrganizationID, updated.OrganizationID)
		return recordTicket(ctx, q, ticket.ID, "ticket_organization_linked", actor.ID, linked)
	})
	if isConstraint(err, "tickets_open_contact_key") {
		// A message opened a ticket of the contact while the resume ran and
		// committed first: it is the one that counts, and the notice names it.
		return db.Ticket{}, s.openTicketOfContact(ctx, ticketID)
	}
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// openTicketOfContact explains a resume refused by the ticket the contact has
// in the sector, opened by a message that won the dispute. The winner may have
// been closed before this reading; then there is no ticket to name, and the
// resume answers that it changed meanwhile, so trying again goes through.
func (s *Service) openTicketOfContact(ctx context.Context, ticketID int64) error {
	t, err := db.AsTicket(s.q.GetTicket(ctx, ticketID))
	if err != nil {
		return fmt.Errorf("get ticket: %w", err)
	}
	open, err := s.q.GetOpenTicketOfContactInSector(ctx, db.GetOpenTicketOfContactInSectorParams{
		SectorID: t.SectorID, ContactID: t.ContactID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrResumeRaced
	}
	if err != nil {
		return fmt.Errorf("get open ticket of the contact: %w", err)
	}
	return &OpenTicketError{Protocol: open.Protocol, AssigneeName: open.AssigneeName}
}
