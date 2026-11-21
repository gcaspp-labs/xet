package helpdesk

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/core/audit"
	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// PhoneRegistration is the closing data of a service given by phone, with
// the start and the end of the call. AddSubject and AddSolution add the items
// to the lists, as in the closing form.
type PhoneRegistration struct {
	ContactID        int64
	OrganizationID   int64
	ModuleIDs        []int64
	Subject          string
	Resolution       string
	StartedAt        time.Time
	EndedAt          time.Time
	AddSubject       bool
	SubjectModuleID  *int64
	SolutionModuleID *int64
	AddSolution      bool
}

// PhoneForm returns what the phone registration window starts with for a
// contact in a sector: the same data of the closing form (spec #311), without
// a ticket, since the registration is born closed. A contact of another sector
// is not refused: the call may come from any client, and the modules shown are
// the active ones of the sector.
func (s *Service) PhoneForm(ctx context.Context, actor auth.User, sectorID, contactID int64) (ClosingForm, error) {
	if !actor.CanAccessSector(sectorID) {
		return ClosingForm{}, ErrForbidden
	}
	sector, err := s.q.GetSector(ctx, sectorID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !sector.Active) {
		return ClosingForm{}, ErrSectorNotFound
	} else if err != nil {
		return ClosingForm{}, fmt.Errorf("get sector: %w", err)
	}
	contact, err := s.q.GetContactWithOrganization(ctx, contactID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ClosingForm{}, ErrUnknownContact
	} else if err != nil {
		return ClosingForm{}, fmt.Errorf("get contact: %w", err)
	}
	form, err := s.closingFormData(ctx, sectorID, contactID, time.Now())
	if err != nil {
		return ClosingForm{}, err
	}
	if contact.Contact.OrganizationID != nil {
		org, err := s.q.GetOrganization(ctx, *contact.Contact.OrganizationID)
		if err != nil {
			return ClosingForm{}, fmt.Errorf("get organization: %w", err)
		}
		form.Organization = &org
	}
	return form, nil
}

// RegisterPhone records a service given by phone as a ticket born closed,
// with channel phone, in the sector (spec #311). It does not pass through the
// queue, sends nothing to the messaging provider and does not need the sector
// number connected. An open WhatsApp ticket of the contact in the sector stays
// as it is: the record is born closed, out of reach of the one open ticket per
// contact and sector index. The client_request_id makes a repeated request,
// even a concurrent one, return the same record.
func (s *Service) RegisterPhone(ctx context.Context, actor auth.User, sectorID int64, requestID pgtype.UUID, in PhoneRegistration) (db.Ticket, error) {
	if t, err := s.q.GetTicketByClientRequestID(ctx, requestID); err == nil {
		return repeatedPhone(t, actor, sectorID)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, fmt.Errorf("get ticket by request: %w", err)
	}
	if !actor.CanAccessSector(sectorID) {
		return db.Ticket{}, ErrForbidden
	}
	sector, err := s.q.GetSector(ctx, sectorID)
	if errors.Is(err, pgx.ErrNoRows) || (err == nil && !sector.Active) {
		return db.Ticket{}, ErrSectorNotFound
	} else if err != nil {
		return db.Ticket{}, fmt.Errorf("get sector: %w", err)
	}
	form, err := normalizeClosing(Closing{Subject: in.Subject, Resolution: in.Resolution, ModuleIDs: in.ModuleIDs})
	if err != nil {
		return db.Ticket{}, err
	}
	in.Subject, in.Resolution, in.ModuleIDs = form.Subject, form.Resolution, form.ModuleIDs
	in.StartedAt = in.StartedAt.Truncate(time.Microsecond).UTC()
	in.EndedAt = in.EndedAt.Truncate(time.Microsecond).UTC()
	if in.StartedAt.IsZero() || in.EndedAt.IsZero() || in.StartedAt.After(in.EndedAt) || in.EndedAt.After(time.Now()) {
		return db.Ticket{}, ErrInvalidPeriod
	}

	var ticket db.Ticket
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// The registration of the contact does not change meanwhile.
		contact, err := q.GetContactForShare(ctx, in.ContactID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrUnknownContact
		}
		if err != nil {
			return fmt.Errorf("lock contact: %w", err)
		}
		if !contact.Registered {
			return ErrContactNotRegistered
		}
		if _, err := q.GetOrganization(ctx, in.OrganizationID); errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidOrganization
		} else if err != nil {
			return fmt.Errorf("get organization: %w", err)
		}
		protocol, err := nextProtocol(ctx, q)
		if err != nil {
			return err
		}
		ticket, err = db.AsTicket(q.CreatePhoneTicket(ctx, db.CreatePhoneTicketParams{
			Protocol:        protocol,
			SectorID:        sectorID,
			ContactID:       in.ContactID,
			OrganizationID:  &in.OrganizationID,
			ClientRequestID: requestID,
			ActorID:         &actor.ID,
			Subject:         &in.Subject,
			Resolution:      &in.Resolution,
			StartedAt:       in.StartedAt,
			EndedAt:         &in.EndedAt,
		}))
		if errors.Is(err, pgx.ErrNoRows) {
			// A concurrent request with the same client_request_id committed first.
			return errDuplicate
		}
		if err != nil {
			return fmt.Errorf("create phone ticket: %w", err)
		}
		added, err := q.AddTicketModules(ctx, db.AddTicketModulesParams{TicketID: ticket.ID, ModuleIds: in.ModuleIDs, SectorID: sectorID})
		if err != nil {
			return fmt.Errorf("add ticket modules: %w", err)
		}
		if len(added) != len(in.ModuleIDs) {
			return ErrInvalidModules
		}
		if err := addFormItems(ctx, q, actor.ID, sectorID, in.Subject, in.Resolution, in.ModuleIDs, in.SubjectModuleID, in.SolutionModuleID, in.AddSubject, in.AddSolution); err != nil {
			return err
		}
		changes := audit.Changes{}
		changes.Set("status", (*string)(nil), string(ticket.Status))
		changes.Set("channel", (*string)(nil), string(ticket.Channel))
		changes.Set("assignee_id", (*int64)(nil), ticket.AssigneeID)
		changes.Set("subject", (*string)(nil), ticket.Subject)
		changes.Set("resolution", (*string)(nil), ticket.Resolution)
		changes.Set("organization_id", (*int64)(nil), ticket.OrganizationID)
		changes["module_ids"] = audit.Change{From: []int64{}, To: in.ModuleIDs}
		changes["started_at"] = audit.Change{From: nil, To: ticket.StartedAt.UTC()}
		changes["ended_at"] = audit.Change{From: nil, To: ticket.EndedAt.UTC()}
		return recordTicket(ctx, q, ticket.ID, "ticket_phone_registered", actor.ID, changes)
	})
	if errors.Is(err, errDuplicate) {
		t, err := s.q.GetTicketByClientRequestID(ctx, requestID)
		if err != nil {
			return db.Ticket{}, fmt.Errorf("get ticket by request: %w", err)
		}
		return repeatedPhone(t, actor, sectorID)
	}
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// repeatedPhone returns the record of a repeated registration, refusing a
// request ID used by another author or in another sector.
func repeatedPhone(t db.Ticket, actor auth.User, sectorID int64) (db.Ticket, error) {
	if t.Channel != db.TicketChannelPhone || t.SectorID != sectorID || t.ClosedByID == nil || *t.ClosedByID != actor.ID {
		return db.Ticket{}, ErrRequestReused
	}
	return t, nil
}
