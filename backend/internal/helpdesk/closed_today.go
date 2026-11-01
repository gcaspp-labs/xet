package helpdesk

import (
	"context"
	"fmt"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// ClosedToday returns the tickets of the sector closed on the current day of
// the office clock, latest first. The caller checks the access to the sector.
func (s *Service) ClosedToday(ctx context.Context, sectorID int64) ([]db.ListClosedTicketsRow, error) {
	now := time.Now().In(protocolZone)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, protocolZone)
	end := start.AddDate(0, 0, 1)
	rows, err := s.q.ListClosedTickets(ctx, db.ListClosedTicketsParams{SectorID: sectorID, ClosedFrom: &start, ClosedUntil: &end})
	if err != nil {
		return nil, fmt.Errorf("list closed tickets: %w", err)
	}
	return rows, nil
}
