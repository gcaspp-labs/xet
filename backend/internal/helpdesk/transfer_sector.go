package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// TransferToSector closes the ticket as transferred, without the closing
// form, and opens a ticket linked to it in the queue of another sector
// (#243): only the target sector and an optional reason, and the contact
// needs no registration. Only the assignee transfers. The origin ends at the
// moment of the transfer, with no subject, resolution or modules; the new
// ticket takes the main organization of the contact, if any. The closing, the
// new ticket and the audit go in one transaction: an open ticket of the
// contact in the target refuses the whole transfer.
func (s *Service) TransferToSector(ctx context.Context, actor auth.User, ticketID, sectorID int64, reason string) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	transferReason := optional(strings.TrimSpace(reason))

	var closed, next db.Ticket
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
		// The organization of the contact can't change until the commit, so
		// the new ticket gets the one the contact has now.
		contact, err := q.GetContactForShare(ctx, t.ContactID)
		if err != nil {
			return fmt.Errorf("lock contact: %w", err)
		}

		closed, err = db.AsTicket(q.CloseTransferredTicket(ctx, db.CloseTransferredTicketParams{ID: t.ID, TransferReason: transferReason}))
		if err != nil {
			return fmt.Errorf("close transferred ticket: %w", err)
		}
		next, err = queueInSector(ctx, q, actor, closed, sectorID, contact.OrganizationID)
		if err != nil {
			return err
		}

		changes := audit.Changes{}
		changes.Set("status", string(t.Status), string(closed.Status))
		changes["closure_type"] = audit.Change{From: nil, To: string(closed.ClosureType.ClosureType)}
		changes["ended_at"] = audit.Change{From: nil, To: closed.EndedAt.UTC()}
		if !closed.StartedAt.Equal(t.StartedAt) {
			changes["started_at"] = audit.Change{From: t.StartedAt.UTC(), To: closed.StartedAt.UTC()}
		}
		changes["sector_id"] = audit.Change{From: closed.SectorID, To: next.SectorID}
		changes["next_ticket_id"] = audit.Change{From: nil, To: next.ID}
		if transferReason != nil {
			changes["transfer_reason"] = audit.Change{From: nil, To: *transferReason}
		}
		return recordTicket(ctx, q, closed.ID, "ticket_transferred_sector", actor.ID, changes)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(closed.SectorID, closed.ID))
	s.hub.Publish(realtime.TicketChanged(next.SectorID, next.ID))
	return next, nil
}

// queueInSector opens the ticket that continues the closed one in the queue
// of the target sector, another active sector, and links the contact to it.
// An open ticket of the contact in the target refuses it with ErrOpenInSector.
func queueInSector(ctx context.Context, q *db.Queries, actor auth.User, closed db.Ticket, sectorID int64, organizationID *int64) (db.Ticket, error) {
	target, err := q.GetSector(ctx, sectorID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrInvalidSector
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get sector: %w", err)
	}
	if !target.Active || target.ID == closed.SectorID {
		return db.Ticket{}, ErrInvalidSector
	}

	protocol, err := nextProtocol(ctx, q)
	if err != nil {
		return db.Ticket{}, err
	}
	next, err := db.AsTicket(q.CreateTransferredTicket(ctx, db.CreateTransferredTicketParams{
		Protocol:         protocol,
		SectorID:         target.ID,
		ContactID:        closed.ContactID,
		OrganizationID:   organizationID,
		PreviousTicketID: &closed.ID,
	}))
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrOpenInSector
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("create transferred ticket: %w", err)
	}
	if err := directory.LinkSector(ctx, q, closed.ContactID, target.ID, &actor.ID); err != nil {
		return db.Ticket{}, err
	}
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
