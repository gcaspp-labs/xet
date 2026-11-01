package ticket

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/gcaspp-labs/xet/backend/internal/audit"
	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

var (
	ErrContactNotRegistered = errors.New("contact of the ticket is not registered")
	ErrInvalidOrganization  = errors.New("organization not found")
	ErrInvalidModules       = errors.New("modules are not active modules of the sector")
	ErrInvalidPeriod        = errors.New("end before start or in the future")
	ErrIncompleteClosing    = errors.New("subject, resolution or modules missing")
)

// Closing is the closing form filled by the assignee. A nil StartedAt keeps
// the automatic start (arrival of the first message) and a nil EndedAt ends
// the ticket at the moment it is saved.
type Closing struct {
	Subject        string
	Resolution     string
	ModuleIDs      []int64
	OrganizationID int64
	StartedAt      *time.Time
	EndedAt        *time.Time
}

// ClosingForm is what the closing form shows before the assignee fills it:
// the active modules of the sector, the suggested organization and the
// automatic start.
type ClosingForm struct {
	Modules      []db.Module
	Organization *db.Organization
	StartedAt    time.Time
}

// ClosingForm returns the defaults of the closing form. The organization is
// the one of the ticket or, when it has none yet, the main organization of
// the contact (spec.md, Formulário de encerramento).
func (s *Service) ClosingForm(ctx context.Context, actor auth.User, ticketID int64) (ClosingForm, error) {
	t, err := s.accessible(ctx, actor, ticketID)
	if err != nil {
		return ClosingForm{}, err
	}
	modules, err := s.q.ListActiveModules(ctx, t.SectorID)
	if err != nil {
		return ClosingForm{}, fmt.Errorf("list active modules: %w", err)
	}
	form := ClosingForm{Modules: modules, StartedAt: t.StartedAt}
	orgID := t.OrganizationID
	if orgID == nil {
		c, err := s.q.GetContactWithOrganization(ctx, t.ContactID)
		if err != nil {
			return ClosingForm{}, fmt.Errorf("get contact: %w", err)
		}
		orgID = c.Contact.OrganizationID
	}
	if orgID != nil {
		org, err := s.q.GetOrganization(ctx, *orgID)
		if err != nil {
			return ClosingForm{}, fmt.Errorf("get organization: %w", err)
		}
		form.Organization = &org
	}
	return form, nil
}

// Close ends a ticket in progress with the closing form. Only the assignee
// closes, even supervisors and admins (spec.md). The fields, the modules and
// the audit go in one transaction.
func (s *Service) Close(ctx context.Context, actor auth.User, ticketID int64, in Closing) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	in, err := normalizeClosing(in)
	if err != nil {
		return db.Ticket{}, err
	}

	var ticket db.Ticket
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		var changes audit.Changes
		ticket, changes, err = closeLocked(ctx, q, actor, ticketID, in, db.ClosureTypeResolved)
		if err != nil {
			return err
		}
		return recordTicket(ctx, q, ticket.ID, "ticket_closed", actor.ID, changes)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// normalizeClosing trims the form and checks the required fields.
func normalizeClosing(in Closing) (Closing, error) {
	in.Subject, in.Resolution = strings.TrimSpace(in.Subject), strings.TrimSpace(in.Resolution)
	in.ModuleIDs = slices.Clone(in.ModuleIDs)
	slices.Sort(in.ModuleIDs)
	in.ModuleIDs = slices.Compact(in.ModuleIDs)
	if in.Subject == "" || in.Resolution == "" || len(in.ModuleIDs) == 0 {
		return in, ErrIncompleteClosing
	}
	return in, nil
}

// closeLocked closes the ticket inside the caller's transaction and returns
// the changes for the audit. The ticket is locked, so no message or transfer
// crosses the closing, and the contact is locked for share, so its
// registration does not change meanwhile.
func closeLocked(ctx context.Context, q *db.Queries, actor auth.User, ticketID int64, in Closing, closure db.ClosureType) (db.Ticket, audit.Changes, error) {
	t, err := q.GetTicketForUpdate(ctx, ticketID)
	if err != nil {
		return db.Ticket{}, nil, fmt.Errorf("lock ticket: %w", err)
	}
	if t.Status == db.TicketStatusQueued {
		return db.Ticket{}, nil, ErrNotInProgress
	}
	if err := conducts(t, actor); err != nil {
		return db.Ticket{}, nil, err
	}
	contact, err := q.GetContactForShare(ctx, t.ContactID)
	if err != nil {
		return db.Ticket{}, nil, fmt.Errorf("lock contact: %w", err)
	}
	if !contact.Registered {
		return db.Ticket{}, nil, ErrContactNotRegistered
	}
	if _, err := q.GetOrganization(ctx, in.OrganizationID); errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, nil, ErrInvalidOrganization
	} else if err != nil {
		return db.Ticket{}, nil, fmt.Errorf("get organization: %w", err)
	}

	startedAt := t.StartedAt
	if in.StartedAt != nil {
		startedAt = *in.StartedAt
	}
	// The database clock decides the automatic end; an informed end is
	// checked here and again by the tickets_ended_after_started constraint.
	end := time.Now()
	if in.EndedAt != nil {
		if in.EndedAt.After(end) {
			return db.Ticket{}, nil, ErrInvalidPeriod
		}
		end = *in.EndedAt
	}
	if startedAt.After(end) {
		return db.Ticket{}, nil, ErrInvalidPeriod
	}

	ticket, err := q.CloseTicket(ctx, db.CloseTicketParams{
		ID:             t.ID,
		ClosureType:    closure,
		Subject:        &in.Subject,
		Resolution:     &in.Resolution,
		OrganizationID: &in.OrganizationID,
		StartedAt:      startedAt,
		EndedAt:        in.EndedAt,
	})
	if isConstraint(err, "tickets_ended_after_started") {
		// The database clock ran behind the start checked above.
		return db.Ticket{}, nil, ErrInvalidPeriod
	}
	if err != nil {
		return db.Ticket{}, nil, fmt.Errorf("close ticket: %w", err)
	}
	added, err := q.AddTicketModules(ctx, db.AddTicketModulesParams{TicketID: t.ID, ModuleIds: in.ModuleIDs, SectorID: t.SectorID})
	if err != nil {
		return db.Ticket{}, nil, fmt.Errorf("add ticket modules: %w", err)
	}
	if len(added) != len(in.ModuleIDs) {
		return db.Ticket{}, nil, ErrInvalidModules
	}

	changes := audit.Changes{}
	changes.Set("status", string(t.Status), string(ticket.Status))
	changes.Set("subject", t.Subject, ticket.Subject)
	changes.Set("resolution", t.Resolution, ticket.Resolution)
	changes.Set("organization_id", t.OrganizationID, ticket.OrganizationID)
	changes["module_ids"] = audit.Change{From: []int64{}, To: in.ModuleIDs}
	changes.Set("started_at", t.StartedAt.UTC(), ticket.StartedAt.UTC())
	changes["ended_at"] = audit.Change{From: nil, To: ticket.EndedAt.UTC()}
	return ticket, changes, nil
}

// Modules returns the modules recorded when the ticket was closed.
func (s *Service) Modules(ctx context.Context, actor auth.User, ticketID int64) ([]db.ListTicketModulesRow, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketModules(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list ticket modules: %w", err)
	}
	return rows, nil
}

func isConstraint(err error, name string) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.ConstraintName == name
}
