package helpdesk

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// MessageChanges returns the recorded versions (original and edits) and the
// deletion of a message, in the order they happened. It is a read of the
// history: whoever may see the ticket sees it, open or closed, and no one else.
func (s *Service) MessageChanges(ctx context.Context, actor auth.User, messageID int64) ([]db.ListMessageChangesRow, error) {
	msg, err := s.q.GetMessage(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrMessageNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("get message: %w", err)
	}
	if _, err := s.viewable(ctx, actor, msg.TicketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListMessageChanges(ctx, &messageID)
	if err != nil {
		return nil, fmt.Errorf("list message changes: %w", err)
	}
	return rows, nil
}
