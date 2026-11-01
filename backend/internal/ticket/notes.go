package ticket

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// SetSpokeWith records who the assignee talked to, for phones shared by more
// than one person. An empty value clears it.
func (s *Service) SetSpokeWith(ctx context.Context, actor auth.User, ticketID int64, spokeWith string) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	var ticket db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		ticket, err = q.SetTicketSpokeWith(ctx, db.SetTicketSpokeWithParams{ID: ticketID, SpokeWith: optional(strings.TrimSpace(spokeWith))})
		if err != nil {
			return fmt.Errorf("set spoke with: %w", err)
		}
		return nil
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// Notes returns the internal notes of the ticket, oldest first.
func (s *Service) Notes(ctx context.Context, actor auth.User, ticketID int64) ([]db.ListTicketNotesRow, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketNotes(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list notes: %w", err)
	}
	return rows, nil
}

// AddNote records an internal note. Anyone who sees the ticket may write
// one, even without being the assignee and after closing (spec.md).
func (s *Service) AddNote(ctx context.Context, actor auth.User, ticketID int64, body string) (db.InternalNote, error) {
	t, err := s.accessible(ctx, actor, ticketID)
	if err != nil {
		return db.InternalNote{}, err
	}
	note, err := s.q.CreateInternalNote(ctx, db.CreateInternalNoteParams{TicketID: ticketID, AuthorID: actor.ID, Body: body})
	if err != nil {
		return db.InternalNote{}, fmt.Errorf("create note: %w", err)
	}
	s.hub.Publish(realtime.TicketChanged(t.SectorID, t.ID))
	return note, nil
}
