package helpdesk

import (
	"context"
	"fmt"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// HistoryEntry is a ticket in the history of a contact or an organization.
type HistoryEntry = db.ListContactTicketsRow

// historySector limits a history to the sector of the user; nil for an
// admin, who sees every sector.
func historySector(actor auth.User) *int64 {
	if actor.Role == db.UserRoleAdmin {
		return nil
	}
	return actor.SectorID
}

// HistorySortColumns are the columns shown in the history table.
var HistorySortColumns = []string{"protocol", "arrived", "contact", "sector", "assignee", "status"}

func historyDirection(page paging.Request) string {
	if page.Descending {
		return "desc"
	}
	return "asc"
}

func (s *Service) ContactHistory(ctx context.Context, actor auth.User, contactID int64, page paging.Request) ([]HistoryEntry, int64, paging.Request, error) {
	sector := historySector(actor)
	total, err := s.q.CountContactTickets(ctx, db.CountContactTicketsParams{ContactID: contactID, SectorID: sector})
	if err != nil {
		return nil, 0, page, fmt.Errorf("count contact tickets: %w", err)
	}
	page = page.Clamp(total)
	rows, err := s.q.ListContactTickets(ctx, db.ListContactTicketsParams{ContactID: contactID, SectorID: sector, Sort: page.Sort, Direction: historyDirection(page), PageOffset: page.Offset()})
	if err != nil {
		return nil, 0, page, fmt.Errorf("list contact tickets: %w", err)
	}
	return rows, total, page, nil
}

func (s *Service) OrganizationHistory(ctx context.Context, actor auth.User, organizationID int64, page paging.Request) ([]HistoryEntry, int64, paging.Request, error) {
	sector := historySector(actor)
	total, err := s.q.CountOrganizationTickets(ctx, db.CountOrganizationTicketsParams{OrganizationID: &organizationID, SectorID: sector})
	if err != nil {
		return nil, 0, page, fmt.Errorf("count organization tickets: %w", err)
	}
	page = page.Clamp(total)
	rows, err := s.q.ListOrganizationTickets(ctx, db.ListOrganizationTicketsParams{OrganizationID: &organizationID, SectorID: sector, Sort: page.Sort, Direction: historyDirection(page), PageOffset: page.Offset()})
	if err != nil {
		return nil, 0, page, fmt.Errorf("list organization tickets: %w", err)
	}
	out := make([]HistoryEntry, len(rows))
	for i, r := range rows {
		out[i] = HistoryEntry(r)
	}
	return out, total, page, nil
}
