package helpdesk

import (
	"context"
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
