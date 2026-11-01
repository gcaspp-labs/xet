package ticket

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

// Cancel finishes an open ticket without recording a service, for spam, scams
// and mistakes (spec.md, Cancelamento). Anyone of the sector cancels from the
// queue; in progress, the assignee, supervisors and admins. The ticket is
// locked, so the cancellation does not cross an assignment or a message: the
// permission is checked on the state found under the lock, and the next
// message opens another ticket. The audit with the reason goes in the same
// transaction.
func (s *Service) Cancel(ctx context.Context, actor auth.User, ticketID int64, reason string) (db.Ticket, error) {
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
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if t.Status == db.TicketStatusClosed {
			return ErrClosed
		}
		if t.Status == db.TicketStatusInProgress && *t.AssigneeID != actor.ID && !actor.HasRole(db.UserRoleSupervisor, db.UserRoleAdmin) {
			return ErrCannotCancel
		}

		ticket, err = q.CancelTicket(ctx, db.CancelTicketParams{ID: t.ID, ActorID: actor.ID})
		if err != nil {
			return fmt.Errorf("cancel ticket: %w", err)
		}

		changes := audit.Changes{}
		changes.Set("status", string(t.Status), string(ticket.Status))
		changes["closure_type"] = audit.Change{From: nil, To: string(ticket.ClosureType.ClosureType)}
		changes["ended_at"] = audit.Change{From: nil, To: ticket.EndedAt.UTC()}
		changes.Set("assignee_id", t.AssigneeID, ticket.AssigneeID)
		raw, err := changes.JSON()
		if err != nil {
			return err
		}
		err = q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			TicketID:   &ticket.ID,
			EntityType: "ticket",
			EntityID:   ticket.ID,
			Action:     "ticket_cancelled",
			ActorID:    &actor.ID,
			Reason:     &reason,
			Changes:    raw,
		})
		if err != nil {
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
