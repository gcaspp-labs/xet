package helpdesk

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

// mergeRefusal tells why a closed ticket with this situation is not merged into
// a pending one, or nil when it may be (#341, spec #332): only a resolved or a
// cancelled one. A transferred ticket — including the old transfer made with the
// closing form (#243) — and an already merged one are refused. The detail of the
// ticket and the merge both ask here, so a new situation never shows the action
// and refuses the merge, or the other way around.
func mergeRefusal(closureType db.ClosureType) error {
	switch closureType {
	case db.ClosureTypeResolved, db.ClosureTypeCancelled:
		return nil
	case db.ClosureTypeTransferred:
		return ErrTransferred
	case db.ClosureTypeMerged:
		return ErrMerged
	default:
		return ErrNotClosed
	}
}

// MergeClosedIntoPending merges the closed ticket B into the pending ticket A
// (#341, spec #332): the messages of B pass to A, A takes the situation and the
// closing data of B, and B becomes merged into A. Whoever may correct B does it
// — whoever closed it, supervisors and admins — and only a ticket closed as
// resolved or cancelled: a transferred one (with or without the old form) or an
// already merged one is refused. A must be pending, of the same contact and
// sector as B. No reason is asked: the merge has its own audit.
//
// A is locked first and B after it, the order of resuming a pending ticket from
// a new one (#335), and the contact at the end, as in the closing. So a merge
// never crosses the resume of A from the list (one of them wins, the other finds
// A taken) nor the correction of B.
func (s *Service) MergeClosedIntoPending(ctx context.Context, actor auth.User, ticketID, pendingTicketID int64) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}

	var closed, merged db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// A first, then B, always in this order: the merge of a new ticket into
		// a pending one (#335) is the only other two-ticket action.
		a, err := db.AsTicket(q.GetTicketForUpdate(ctx, pendingTicketID))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("lock pending ticket: %w", err)
		}
		b, err := db.AsTicket(q.GetTicketForUpdate(ctx, ticketID))
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if b.Status != db.TicketStatusClosed {
			return ErrNotClosed
		}
		if err := mergeRefusal(b.ClosureType.ClosureType); err != nil {
			return err
		}
		if !mayCorrect(b, actor) {
			return ErrCannotCorrect
		}
		if a.Status != db.TicketStatusPending {
			return ErrNotPending
		}
		if a.ContactID != b.ContactID || a.SectorID != b.SectorID {
			return ErrPendingMismatch
		}
		if b.EndedAt == nil || b.ClosedAt == nil || b.ClosedByID == nil || b.AssigneeID == nil {
			return fmt.Errorf("closed ticket %d without the closing data", b.ID)
		}
		// The contact is locked after the tickets, in the order of the closing,
		// so the registration of the contact never waits on this one.
		if _, err := q.GetContactForShare(ctx, b.ContactID); err != nil {
			return fmt.Errorf("lock contact: %w", err)
		}

		// O motivo do cancelamento ficou só na auditoria de B, que passa a ser
		// mesclado: A o herda como dado de cancelamento (spec #332).
		var cancelReason *string
		if b.ClosureType.ClosureType == db.ClosureTypeCancelled {
			cancelReason, err = q.GetTicketCancellationReason(ctx, &b.ID)
			if err != nil && !errors.Is(err, pgx.ErrNoRows) {
				return fmt.Errorf("read cancellation reason: %w", err)
			}
		}

		// Os módulos são lidos antes de mudar: a auditoria de B guarda os que
		// ele deixou, e a de A os que ela herdou.
		modules, err := q.ListTicketModuleIDs(ctx, b.ID)
		if err != nil {
			return fmt.Errorf("list ticket modules: %w", err)
		}
		messageIDs, err := q.MoveMessagesToTicket(ctx, db.MoveMessagesToTicketParams{ToTicketID: a.ID, FromTicketID: b.ID})
		if err != nil {
			return fmt.Errorf("move messages: %w", err)
		}
		if err := q.MoveMessageActionsToTicket(ctx, db.MoveMessageActionsToTicketParams{ToTicketID: a.ID, FromTicketID: b.ID}); err != nil {
			return fmt.Errorf("move message actions: %w", err)
		}
		if len(modules) > 0 {
			if err := q.MoveTicketModulesToTicket(ctx, db.MoveTicketModulesToTicketParams{ToTicketID: a.ID, FromTicketID: b.ID}); err != nil {
				return fmt.Errorf("move ticket modules: %w", err)
			}
			if err := q.DeleteTicketModules(ctx, b.ID); err != nil {
				return fmt.Errorf("delete ticket modules: %w", err)
			}
		}

		closed, err = db.AsTicket(q.ClosePendingByMerge(ctx, db.ClosePendingByMergeParams{
			ID:             a.ID,
			ClosureType:    b.ClosureType.ClosureType,
			Subject:        b.Subject,
			Resolution:     b.Resolution,
			OrganizationID: b.OrganizationID,
			EndedAt:        *b.EndedAt,
			ClosedAt:       *b.ClosedAt,
			ClosedByID:     *b.ClosedByID,
			AssigneeID:     *b.AssigneeID,
		}))
		if err != nil {
			return fmt.Errorf("close pending ticket by merge: %w", err)
		}
		merged, err = db.AsTicket(q.MergeClosedTicket(ctx, db.MergeClosedTicketParams{ID: b.ID, MergedIntoTicketID: a.ID}))
		if err != nil {
			return fmt.Errorf("merge ticket: %w", err)
		}

		// B tells how it went: A, the messages that passed and the closing data
		// it left (#336 reads them here).
		mergedChanges := audit.Changes{}
		mergedChanges.Set("closure_type", string(b.ClosureType.ClosureType), string(merged.ClosureType.ClosureType))
		mergedChanges.Set("merged_into_ticket_id", nil, a.ID)
		mergedChanges.Set("subject", b.Subject, merged.Subject)
		mergedChanges.Set("resolution", b.Resolution, merged.Resolution)
		if len(modules) > 0 {
			mergedChanges["module_ids"] = audit.Change{From: modules, To: []int64{}}
		}
		mergedChanges.Set("message_ids", nil, messageIDs)
		if err := recordTicket(ctx, q, b.ID, "ticket_merged", actor.ID, mergedChanges); err != nil {
			return err
		}
		// A tells what it inherited, and from which ticket: the notice of the
		// conversation names B's protocol.
		closedChanges := audit.Changes{}
		closedChanges.Set("status", string(a.Status), string(closed.Status))
		closedChanges.Set("closure_type", nil, string(closed.ClosureType.ClosureType))
		closedChanges.Set("subject", a.Subject, closed.Subject)
		closedChanges.Set("resolution", a.Resolution, closed.Resolution)
		closedChanges.Set("organization_id", a.OrganizationID, closed.OrganizationID)
		if len(modules) > 0 {
			closedChanges["module_ids"] = audit.Change{From: nil, To: modules}
		}
		closedChanges.Set("ended_at", nil, closed.EndedAt.UTC())
		closedChanges.Set("closed_at", nil, closed.ClosedAt.UTC())
		closedChanges.Set("closed_by_id", nil, closed.ClosedByID)
		closedChanges.Set("assignee_id", a.AssigneeID, closed.AssigneeID)
		closedChanges.Set("merged_ticket_id", nil, b.ID)
		closedChanges.Set("merged_protocol", nil, b.Protocol)
		return recordTicketReason(ctx, q, a.ID, "ticket_closed_by_merge", actor.ID, cancelReason, closedChanges)
	})
	if err != nil {
		return db.Ticket{}, err
	}
	// Both lists change: B leaves the attendance and A leaves the pending ones.
	s.hub.Publish(realtime.TicketChanged(closed.SectorID, closed.ID))
	s.hub.Publish(realtime.TicketChanged(merged.SectorID, merged.ID))
	return closed, nil
}
