package helpdesk

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// ReturnToQueue takes a ticket in progress back to the queue of its sector,
// without an assignee. The assignee returns their own ticket; supervisors and
// admins return anyone's (spec.md, Devolver à fila). The ticket is locked, so
// the change does not cross a message being sent or the ticket being closed,
// and the permission is checked on the state found under the lock. The first
// assignment time stays.
func (s *Service) ReturnToQueue(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
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
			return ErrNotInProgress
		}
		if *t.AssigneeID != actor.ID && !actor.HasRole(db.UserRoleSupervisor, db.UserRoleAdmin) {
			return ErrCannotReturn
		}

		ticket, err = db.AsTicket(q.ReturnTicketToQueue(ctx, t.ID))
		if err != nil {
			return fmt.Errorf("return ticket: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("status", string(t.Status), string(ticket.Status))
		changes.Set("assignee_id", t.AssigneeID, ticket.AssigneeID)
		return recordTicket(ctx, q, ticket.ID, "ticket_returned", actor.ID, changes)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}
