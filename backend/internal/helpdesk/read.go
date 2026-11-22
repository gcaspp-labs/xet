package helpdesk

import (
	"context"
	"fmt"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// MarkRead records that the assignee read the ticket up to now (#313, spec
// #310), which is the mark of the unread messages of the list, and notifies
// the sector so the other tabs and computers of the user reload it. Only the
// current assignee of a ticket in progress changes anything: for anyone else,
// or any other state, it succeeds without changing anything, so a screen
// opened by another user never fails. The moment is the server's clock
// (clock_timestamp(), the instant of the write, not the start of the
// transaction) and only moves forward; repeating it is harmless.
func (s *Service) MarkRead(ctx context.Context, actor auth.User, ticketID int64) error {
	ticket, err := s.accessible(ctx, actor, ticketID)
	if err != nil {
		return err
	}
	if ticket.Status != db.TicketStatusInProgress || ticket.AssigneeID == nil || *ticket.AssigneeID != actor.ID {
		return nil
	}
	changed, err := s.q.MarkTicketRead(ctx, db.MarkTicketReadParams{ID: ticketID, AssigneeID: &actor.ID})
	if err != nil {
		return fmt.Errorf("mark ticket read: %w", err)
	}
	if changed > 0 {
		s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	}
	return nil
}
