package helpdesk

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// Started is the result of starting a conversation: the new ticket with the
// first message, or, when the contact already had an open ticket in the
// sector, that ticket (Existing) and no message.
type Started struct {
	TicketID int64
	Existing bool
	Message  *db.Message
}

// OpenTicketID returns the open ticket of the contact in the sector, if any.
// The caller checks the access to the sector.
func (s *Service) OpenTicketID(ctx context.Context, sectorID, contactID int64) (*int64, error) {
	id, err := s.q.GetOpenTicketID(ctx, db.GetOpenTicketIDParams{SectorID: sectorID, ContactID: contactID})
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get open ticket: %w", err)
	}
	return &id, nil
}

// Start opens a conversation with the contact through the sector number: the
// first message creates a ticket assigned to the user, who conducts it from
// then on. When the contact already has an open ticket in the sector, nothing
// is sent and the user is directed to it; that alone does not let them reply,
// which still depends on being its assignee (spec.md, Iniciar conversas). The
// client_request_id makes a repeated request return the same ticket and
// message without sending again.
func (s *Service) Start(ctx context.Context, provider messaging.Provider, actor auth.User, sectorID, contactID int64, requestID pgtype.UUID, body string) (Started, error) {
	if m, err := s.q.GetMessageByClientRequestID(ctx, requestID); err == nil {
		return repeatedStart(m, actor, sectorID, contactID)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return Started{}, fmt.Errorf("get message by request: %w", err)
	}
	if !actor.CanAccessSector(sectorID) {
		return Started{}, ErrForbidden
	}
	if _, err := s.q.GetSector(ctx, sectorID); errors.Is(err, pgx.ErrNoRows) {
		return Started{}, ErrSectorNotFound
	} else if err != nil {
		return Started{}, fmt.Errorf("get sector: %w", err)
	}
	contact, err := s.q.GetContactWithOrganization(ctx, contactID)
	if errors.Is(err, pgx.ErrNoRows) {
		return Started{}, ErrUnknownContact
	}
	if err != nil {
		return Started{}, fmt.Errorf("get contact: %w", err)
	}
	if contact.Contact.Phone == nil && contact.Contact.ExternalContactID == nil {
		return Started{}, ErrContactWithoutPhone
	}

	var existing int64
	var msg db.Message
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// An open ticket is locked, so it cannot be closed meanwhile.
		open, err := q.GetOpenTicketForUpdate(ctx, db.GetOpenTicketForUpdateParams{SectorID: sectorID, ContactID: contactID})
		if err == nil {
			existing = open.ID
			return errOpenTicket
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("get open ticket: %w", err)
		}
		protocol, err := nextProtocol(ctx, q)
		if err != nil {
			return err
		}
		t, err := q.CreateStartedTicket(ctx, db.CreateStartedTicketParams{
			Protocol:       protocol,
			SectorID:       sectorID,
			ContactID:      contactID,
			OrganizationID: contact.Contact.OrganizationID,
			AssigneeID:     &actor.ID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			// A message or another agent opened the ticket first and committed.
			id, err := q.GetOpenTicketID(ctx, db.GetOpenTicketIDParams{SectorID: sectorID, ContactID: contactID})
			if err != nil {
				return fmt.Errorf("get open ticket: %w", err)
			}
			existing = id
			return errOpenTicket
		}
		if err != nil {
			return fmt.Errorf("create ticket: %w", err)
		}
		if err := directory.LinkSector(ctx, q, contactID, sectorID, &actor.ID); err != nil {
			return err
		}
		// Starting counts as assigning: the ticket is born with the user.
		changes := audit.Changes{}
		changes.Set("status", (*string)(nil), string(t.Status))
		changes.Set("assignee_id", (*int64)(nil), t.AssigneeID)
		if err := recordTicket(ctx, q, t.ID, "ticket_started", actor.ID, changes); err != nil {
			return err
		}
		msg, err = q.CreateAgentMessage(ctx, db.CreateAgentMessageParams{
			TicketID:        t.ID,
			SectorID:        t.SectorID,
			ContactID:       t.ContactID,
			AuthorID:        &actor.ID,
			Type:            db.MessageTypeText,
			Body:            &body,
			ClientRequestID: requestID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return errDuplicate
		}
		if err != nil {
			return fmt.Errorf("create message: %w", err)
		}
		return nil
	})
	switch {
	case errors.Is(err, errOpenTicket):
		// The open ticket may be the one a concurrent request with the same
		// client_request_id has just created: then this is a repetition.
		if m, err := s.q.GetMessageByClientRequestID(ctx, requestID); err == nil {
			return repeatedStart(m, actor, sectorID, contactID)
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return Started{}, fmt.Errorf("get message by request: %w", err)
		}
		return Started{TicketID: existing, Existing: true}, nil
	case errors.Is(err, errDuplicate):
		// A concurrent request with the same client_request_id won; its
		// ticket was kept and this one rolled back.
		m, err := s.q.GetMessageByClientRequestID(ctx, requestID)
		if err != nil {
			return Started{}, fmt.Errorf("get message by request: %w", err)
		}
		return repeatedStart(m, actor, sectorID, contactID)
	case err != nil:
		return Started{}, err
	}
	s.hub.Publish(realtime.TicketChanged(msg.SectorID, msg.TicketID))
	sent := s.deliver(ctx, provider, msg)
	return Started{TicketID: sent.TicketID, Message: &sent}, nil
}

// repeatedStart returns the ticket and message of a repeated start, refusing
// a request ID used by another author, sector or contact.
func repeatedStart(m db.Message, actor auth.User, sectorID, contactID int64) (Started, error) {
	if m.SectorID != sectorID || m.ContactID != contactID || m.AuthorID == nil || *m.AuthorID != actor.ID {
		return Started{}, ErrRequestReused
	}
	return Started{TicketID: m.TicketID, Message: &m}, nil
}
