package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// accessible returns the ticket when the user may see its sector.
func (s *Service) accessible(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	t, err := s.q.GetTicket(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrNotFound
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get ticket: %w", err)
	}
	if !actor.CanAccessSector(t.SectorID) {
		return db.Ticket{}, ErrForbidden
	}
	return t, nil
}

// viewable returns the ticket when the user may read it: its sector is
// accessible or a later ticket of the chain of transfers between sectors is
// (spec.md, Transferências). Acting on the ticket still needs accessible.
func (s *Service) viewable(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	t, err := s.q.GetTicket(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrNotFound
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get ticket: %w", err)
	}
	if actor.CanAccessSector(t.SectorID) {
		return t, nil
	}
	sectors, err := s.q.ListLaterTicketSectors(ctx, ticketID)
	if err != nil {
		return db.Ticket{}, fmt.Errorf("list later ticket sectors: %w", err)
	}
	if slices.ContainsFunc(sectors, actor.CanAccessSector) {
		return t, nil
	}
	return db.Ticket{}, ErrForbidden
}

// conducts checks, on the locked ticket, that the user may conduct the
// conversation: the ticket is open and the user is its assignee. Admins and
// supervisors are no exception (spec.md).
func conducts(t db.Ticket, actor auth.User) error {
	if t.Status == db.TicketStatusClosed {
		return ErrClosed
	}
	if t.AssigneeID == nil || *t.AssigneeID != actor.ID {
		return ErrNotAssignee
	}
	return nil
}
