package ticket

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// AssignmentLog is an assignment or a transfer shown in the conversation.
type AssignmentLog = db.ListTicketAssignmentLogsRow

// Transfer hands a ticket in progress to another active user of its sector.
// The assignee transfers their own ticket; supervisors and admins transfer
// anyone's (spec.md, Transferências). The ticket is locked, so the change
// does not cross a message being sent or the ticket being closed, and the
// target is locked for share, so it is not deactivated meanwhile.
// Transferring again to the current assignee succeeds without a new record,
// so a repeated click is harmless.
func (s *Service) Transfer(ctx context.Context, actor auth.User, ticketID, targetID int64) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}

	var ticket db.Ticket
	changed := false
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		switch t.Status {
		case db.TicketStatusClosed:
			return ErrClosed
		case db.TicketStatusQueued:
			return ErrNotInProgress
		}
		if *t.AssigneeID == targetID {
			ticket = t
			return nil
		}
		if *t.AssigneeID != actor.ID && !actor.HasRole(db.UserRoleSupervisor, db.UserRoleAdmin) {
			return ErrCannotTransfer
		}
		target, err := q.GetUserForShare(ctx, targetID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidTarget
		}
		if err != nil {
			return fmt.Errorf("lock target user: %w", err)
		}
		if !target.Active || target.SectorID == nil || *target.SectorID != t.SectorID {
			return ErrInvalidTarget
		}

		ticket, err = q.TransferTicket(ctx, db.TransferTicketParams{ID: t.ID, AssigneeID: &target.ID})
		if err != nil {
			return fmt.Errorf("transfer ticket: %w", err)
		}
		changed = true
		changes := audit.Changes{}
		changes.Set("assignee_id", t.AssigneeID, ticket.AssigneeID)
		return recordTicket(ctx, q, ticket.ID, "ticket_transferred_user", actor.ID, changes)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	if changed {
		s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	}
	return ticket, nil
}

// AssignmentLogs returns how the ticket got its first assignee (started or
// assigned) and each transfer.
func (s *Service) AssignmentLogs(ctx context.Context, actor auth.User, ticketID int64) ([]AssignmentLog, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketAssignmentLogs(ctx, &ticketID)
	if err != nil {
		return nil, fmt.Errorf("list assignment logs: %w", err)
	}
	return rows, nil
}
