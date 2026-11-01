package ticket

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Summary is an open ticket as shown in the panel lists.
type Summary struct {
	db.ListOpenTicketsRow
	// LastMessage is nil for a ticket without messages yet.
	LastMessage *db.ListLastMessagesRow
}

// ListOpen returns the open tickets of the sector, oldest first, with their
// last message. The caller checks the access to the sector.
func (s *Service) ListOpen(ctx context.Context, sectorID int64) ([]Summary, error) {
	rows, err := s.q.ListOpenTickets(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list open tickets: %w", err)
	}
	ids := make([]int64, len(rows))
	for i, r := range rows {
		ids[i] = r.ID
	}
	last, err := s.q.ListLastMessages(ctx, ids)
	if err != nil {
		return nil, fmt.Errorf("list last messages: %w", err)
	}
	byTicket := make(map[int64]*db.ListLastMessagesRow, len(last))
	for i := range last {
		byTicket[last[i].TicketID] = &last[i]
	}
	out := make([]Summary, len(rows))
	for i, r := range rows {
		out[i] = Summary{ListOpenTicketsRow: r, LastMessage: byTicket[r.ID]}
	}
	return out, nil
}

// Workload returns the users of the sector, and anyone else with tickets in
// progress there, with how many tickets each one is handling. There is no
// limit; the count only informs the team.
func (s *Service) Workload(ctx context.Context, sectorID int64) ([]db.ListSectorWorkloadRow, error) {
	rows, err := s.q.ListSectorWorkload(ctx, sectorID)
	if err != nil {
		return nil, fmt.Errorf("list sector workload: %w", err)
	}
	return rows, nil
}

// Assign makes the user the assignee of a queued ticket. The conditional
// update decides between simultaneous attempts: only one finds the ticket
// still queued. Assigning again a ticket the user already holds succeeds
// without a new record, so a repeated click is harmless.
func (s *Service) Assign(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	// The sector of a ticket never changes, so it is checked before the update.
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}

	var ticket db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var err error
		ticket, err = q.AssignTicket(ctx, db.AssignTicketParams{ID: ticketID, AssigneeID: &actor.ID})
		if errors.Is(err, pgx.ErrNoRows) {
			return errNotQueued
		}
		if err != nil {
			return fmt.Errorf("assign ticket: %w", err)
		}
		changes := audit.Changes{}
		changes.Set("status", string(db.TicketStatusQueued), string(ticket.Status))
		changes.Set("assignee_id", (*int64)(nil), ticket.AssigneeID)
		return recordTicket(ctx, q, ticket.ID, "ticket_assigned", actor.ID, changes)
	})
	if errors.Is(err, errNotQueued) {
		return s.notQueued(ctx, actor, ticketID)
	}
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// notQueued explains why the ticket could not be assigned.
func (s *Service) notQueued(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	ticket, err := s.q.GetTicket(ctx, ticketID)
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get ticket: %w", err)
	}
	switch {
	case ticket.Status == db.TicketStatusClosed:
		return db.Ticket{}, ErrClosed
	case ticket.AssigneeID != nil && *ticket.AssigneeID == actor.ID:
		return ticket, nil
	default:
		return db.Ticket{}, ErrAlreadyAssigned
	}
}
