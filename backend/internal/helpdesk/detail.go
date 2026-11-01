package helpdesk

import (
	"context"
	"fmt"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Detail returns the ticket with its contact, organization and assignee.
func (s *Service) Detail(ctx context.Context, actor auth.User, ticketID int64) (db.GetTicketDetailRow, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
		return db.GetTicketDetailRow{}, err
	}
	d, err := s.q.GetTicketDetail(ctx, ticketID)
	if err != nil {
		return db.GetTicketDetailRow{}, fmt.Errorf("get ticket detail: %w", err)
	}
	return d, nil
}
