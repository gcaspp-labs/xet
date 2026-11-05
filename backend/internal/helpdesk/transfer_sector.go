package helpdesk

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// TransferSector closes the ticket with the closing form as transferred and
// opens a ticket linked to it in the queue of another sector (spec.md,
// Transferências entre setores). Only the assignee transfers, as in the
// closing. The closing, the new ticket and the audit go in one transaction:
// an open ticket of the contact in the target refuses the whole transfer.
func (s *Service) TransferSector(ctx context.Context, actor auth.User, ticketID, sectorID int64, in Closing) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	in, err := normalizeClosing(in)
	if err != nil {
		return db.Ticket{}, err
	}

	var closed, next db.Ticket
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var changes audit.Changes
		closed, changes, err = closeLocked(ctx, q, actor, ticketID, in, db.ClosureTypeTransferred)
		if err != nil {
			return err
		}
		target, err := q.GetSector(ctx, sectorID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidSector
		}
		if err != nil {
			return fmt.Errorf("get sector: %w", err)
		}
		if !target.Active || target.ID == closed.SectorID {
			return ErrInvalidSector
		}

		protocol, err := nextProtocol(ctx, q)
		if err != nil {
			return err
		}
		next, err = q.CreateTransferredTicket(ctx, db.CreateTransferredTicketParams{
			Protocol:         protocol,
			SectorID:         target.ID,
			ContactID:        closed.ContactID,
			OrganizationID:   closed.OrganizationID,
			PreviousTicketID: &closed.ID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrOpenInSector
		}
		if err != nil {
			return fmt.Errorf("create transferred ticket: %w", err)
		}
		if err := directory.LinkSector(ctx, q, closed.ContactID, target.ID, &actor.ID); err != nil {
			return err
		}
		if in.AddSubject {
			if err := addFormSubject(ctx, q, actor.ID, closed.SectorID, in.Subject); err != nil {
				return err
			}
		}
		changes["sector_id"] = audit.Change{From: closed.SectorID, To: target.ID}
		changes["next_ticket_id"] = audit.Change{From: nil, To: next.ID}
		return recordTicket(ctx, q, closed.ID, "ticket_transferred_sector", actor.ID, changes)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(closed.SectorID, closed.ID))
	s.hub.Publish(realtime.TicketChanged(next.SectorID, next.ID))
	return next, nil
}

// TransferSectors returns the sectors the ticket may be transferred to:
// the other active sectors.
func (s *Service) TransferSectors(ctx context.Context, actor auth.User, ticketID int64) ([]db.Sector, error) {
	t, err := s.accessible(ctx, actor, ticketID)
	if err != nil {
		return nil, err
	}
	sectors, err := s.q.ListSectors(ctx)
	if err != nil {
		return nil, fmt.Errorf("list sectors: %w", err)
	}
	out := sectors[:0]
	for _, sec := range sectors {
		if sec.Active && sec.ID != t.SectorID {
			out = append(out, sec)
		}
	}
	return out, nil
}
