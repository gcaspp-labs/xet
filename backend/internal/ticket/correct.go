package ticket

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/audit"
	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

// Correction is the full closing data of a closed ticket after the
// correction, with the reason for it.
type Correction struct {
	Subject        string
	Resolution     string
	ModuleIDs      []int64
	OrganizationID int64
	StartedAt      time.Time
	EndedAt        time.Time
	SpokeWith      string
	Reason         string
}

// Correct changes the closing data of a closed ticket. Whoever closed it,
// supervisors of the sector and admins correct (spec.md, Encerramento,
// retorno e correções). The ticket is locked, so two corrections do not
// cross, and the data, the modules and the audit with the reason go in one
// transaction. Modules already recorded may stay even if deactivated since;
// added ones must be active modules of the sector.
func (s *Service) Correct(ctx context.Context, actor auth.User, ticketID int64, in Correction) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	in.SpokeWith, in.Reason = strings.TrimSpace(in.SpokeWith), strings.TrimSpace(in.Reason)
	if in.Reason == "" {
		return db.Ticket{}, ErrReasonRequired
	}
	form, err := normalizeClosing(Closing{Subject: in.Subject, Resolution: in.Resolution, ModuleIDs: in.ModuleIDs})
	if err != nil {
		return db.Ticket{}, err
	}
	in.Subject, in.Resolution, in.ModuleIDs = form.Subject, form.Resolution, form.ModuleIDs
	// The database keeps microseconds; truncating makes an unchanged time compare equal.
	in.StartedAt = in.StartedAt.Truncate(time.Microsecond).UTC()
	in.EndedAt = in.EndedAt.Truncate(time.Microsecond).UTC()
	if in.StartedAt.After(in.EndedAt) || in.EndedAt.After(time.Now()) {
		return db.Ticket{}, ErrInvalidPeriod
	}

	var ticket db.Ticket
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if t.Status != db.TicketStatusClosed {
			return ErrNotClosed
		}
		if t.ClosureType.ClosureType == db.ClosureTypeCancelled {
			return ErrCancelled
		}
		if (t.ClosedByID == nil || *t.ClosedByID != actor.ID) && !actor.HasRole(db.UserRoleSupervisor, db.UserRoleAdmin) {
			return ErrCannotCorrect
		}
		if _, err := q.GetOrganization(ctx, in.OrganizationID); errors.Is(err, pgx.ErrNoRows) {
			return ErrInvalidOrganization
		} else if err != nil {
			return fmt.Errorf("get organization: %w", err)
		}

		current, err := q.ListTicketModuleIDs(ctx, t.ID)
		if err != nil {
			return fmt.Errorf("list ticket modules: %w", err)
		}
		var added, removed []int64
		for _, id := range in.ModuleIDs {
			if !slices.Contains(current, id) {
				added = append(added, id)
			}
		}
		for _, id := range current {
			if !slices.Contains(in.ModuleIDs, id) {
				removed = append(removed, id)
			}
		}
		if len(added) > 0 {
			rows, err := q.AddTicketModules(ctx, db.AddTicketModulesParams{TicketID: t.ID, ModuleIds: added, SectorID: t.SectorID})
			if err != nil {
				return fmt.Errorf("add ticket modules: %w", err)
			}
			if len(rows) != len(added) {
				return ErrInvalidModules
			}
		}
		if len(removed) > 0 {
			if err := q.RemoveTicketModules(ctx, db.RemoveTicketModulesParams{TicketID: t.ID, ModuleIds: removed}); err != nil {
				return fmt.Errorf("remove ticket modules: %w", err)
			}
		}

		ticket, err = q.CorrectTicket(ctx, db.CorrectTicketParams{
			ID:             t.ID,
			Subject:        &in.Subject,
			Resolution:     &in.Resolution,
			OrganizationID: &in.OrganizationID,
			StartedAt:      in.StartedAt,
			EndedAt:        &in.EndedAt,
			SpokeWith:      optional(in.SpokeWith),
		})
		if isConstraint(err, "tickets_ended_after_started") {
			return ErrInvalidPeriod
		}
		if err != nil {
			return fmt.Errorf("correct ticket: %w", err)
		}

		changes := audit.Changes{}
		changes.Set("subject", t.Subject, ticket.Subject)
		changes.Set("resolution", t.Resolution, ticket.Resolution)
		changes.Set("organization_id", t.OrganizationID, ticket.OrganizationID)
		if len(added) > 0 || len(removed) > 0 {
			changes["module_ids"] = audit.Change{From: current, To: in.ModuleIDs}
		}
		changes.Set("started_at", t.StartedAt.UTC(), ticket.StartedAt.UTC())
		changes.Set("ended_at", t.EndedAt.UTC(), ticket.EndedAt.UTC())
		changes.Set("spoke_with", t.SpokeWith, ticket.SpokeWith)
		if changes.Empty() {
			return ErrNoChanges
		}
		raw, err := changes.JSON()
		if err != nil {
			return err
		}
		err = q.CreateAuditLog(ctx, db.CreateAuditLogParams{
			TicketID:   &ticket.ID,
			EntityType: "ticket",
			EntityID:   ticket.ID,
			Action:     "ticket_corrected",
			ActorID:    &actor.ID,
			Reason:     &in.Reason,
			Changes:    raw,
		})
		if isConstraint(err, "audit_logs_correction_reason") {
			return ErrReasonRequired
		}
		if err != nil {
			return fmt.Errorf("audit: %w", err)
		}
		return nil
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// CorrectionLog is a correction shown in the history of changes, with the
// organizations and modules by name.
type CorrectionLog struct {
	ID        int64
	CreatedAt time.Time
	ActorID   *int64
	ActorName *string
	Reason    string
	Changes   []FieldChange
}

// FieldChange is the previous and new value of a corrected field. Field is
// one of subject, resolution, organization, modules, started_at, ended_at and
// spoke_with; organization is a name, modules a list of names and the times
// are time.Time.
type FieldChange struct {
	Field string
	From  any
	To    any
}

type rawChange struct {
	From json.RawMessage `json:"from"`
	To   json.RawMessage `json:"to"`
}

// Corrections returns the corrections of the ticket, oldest first.
func (s *Service) Corrections(ctx context.Context, actor auth.User, ticketID int64) ([]CorrectionLog, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketCorrections(ctx, &ticketID)
	if err != nil {
		return nil, fmt.Errorf("list corrections: %w", err)
	}

	parsed := make([]map[string]rawChange, len(rows))
	var orgIDs, moduleIDs []int64
	for i, r := range rows {
		if err := json.Unmarshal(r.Changes, &parsed[i]); err != nil {
			return nil, fmt.Errorf("decode correction %d: %w", r.ID, err)
		}
		if c, ok := parsed[i]["organization_id"]; ok {
			for _, v := range []json.RawMessage{c.From, c.To} {
				var id *int64
				if err := json.Unmarshal(v, &id); err != nil {
					return nil, fmt.Errorf("decode organization of correction %d: %w", r.ID, err)
				}
				if id != nil {
					orgIDs = append(orgIDs, *id)
				}
			}
		}
		if c, ok := parsed[i]["module_ids"]; ok {
			for _, v := range []json.RawMessage{c.From, c.To} {
				var ids []int64
				if err := json.Unmarshal(v, &ids); err != nil {
					return nil, fmt.Errorf("decode modules of correction %d: %w", r.ID, err)
				}
				moduleIDs = append(moduleIDs, ids...)
			}
		}
	}
	orgNames := map[int64]string{}
	if len(orgIDs) > 0 {
		orgs, err := s.q.ListOrganizationNames(ctx, orgIDs)
		if err != nil {
			return nil, fmt.Errorf("list organization names: %w", err)
		}
		for _, o := range orgs {
			orgNames[o.ID] = o.Name
		}
	}
	moduleNames := map[int64]string{}
	if len(moduleIDs) > 0 {
		modules, err := s.q.ListModuleNames(ctx, moduleIDs)
		if err != nil {
			return nil, fmt.Errorf("list module names: %w", err)
		}
		for _, m := range modules {
			moduleNames[m.ID] = m.Name
		}
	}

	out := make([]CorrectionLog, len(rows))
	for i, r := range rows {
		out[i] = CorrectionLog{ID: r.ID, CreatedAt: r.CreatedAt, ActorID: r.ActorID, ActorName: r.ActorName}
		if r.Reason != nil {
			out[i].Reason = *r.Reason
		}
		for _, f := range []struct{ key, field string }{
			{"subject", "subject"}, {"resolution", "resolution"}, {"organization_id", "organization"},
			{"module_ids", "modules"}, {"started_at", "started_at"}, {"ended_at", "ended_at"}, {"spoke_with", "spoke_with"},
		} {
			c, ok := parsed[i][f.key]
			if !ok {
				continue
			}
			from, err := changeValue(f.field, c.From, orgNames, moduleNames)
			if err != nil {
				return nil, fmt.Errorf("decode %s of correction %d: %w", f.key, r.ID, err)
			}
			to, err := changeValue(f.field, c.To, orgNames, moduleNames)
			if err != nil {
				return nil, fmt.Errorf("decode %s of correction %d: %w", f.key, r.ID, err)
			}
			out[i].Changes = append(out[i].Changes, FieldChange{Field: f.field, From: from, To: to})
		}
	}
	return out, nil
}

func changeValue(field string, raw json.RawMessage, orgNames, moduleNames map[int64]string) (any, error) {
	switch field {
	case "organization":
		var id *int64
		if err := json.Unmarshal(raw, &id); err != nil || id == nil {
			return nil, err
		}
		return orgNames[*id], nil
	case "modules":
		var ids []int64
		if err := json.Unmarshal(raw, &ids); err != nil {
			return nil, err
		}
		names := make([]string, len(ids))
		for i, id := range ids {
			names[i] = moduleNames[id]
		}
		slices.SortFunc(names, func(a, b string) int { return strings.Compare(strings.ToLower(a), strings.ToLower(b)) })
		return names, nil
	case "started_at", "ended_at":
		var t *time.Time
		if err := json.Unmarshal(raw, &t); err != nil || t == nil {
			return nil, err
		}
		return *t, nil
	default:
		var s *string
		if err := json.Unmarshal(raw, &s); err != nil || s == nil {
			return nil, err
		}
		return *s, nil
	}
}
