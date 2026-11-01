package helpdesk

import (
	"context"
	"fmt"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
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

// ContactHistory lists the tickets of the contact in the sectors the user
// may see, newest first.
func (s *Service) ContactHistory(ctx context.Context, actor auth.User, contactID int64) ([]HistoryEntry, error) {
	rows, err := s.q.ListContactTickets(ctx, db.ListContactTicketsParams{ContactID: contactID, SectorID: historySector(actor)})
	if err != nil {
		return nil, fmt.Errorf("list contact tickets: %w", err)
	}
	return rows, nil
}

// OrganizationHistory lists the tickets of the organization in the sectors
// the user may see, newest first.
func (s *Service) OrganizationHistory(ctx context.Context, actor auth.User, organizationID int64) ([]HistoryEntry, error) {
	rows, err := s.q.ListOrganizationTickets(ctx, db.ListOrganizationTicketsParams{OrganizationID: &organizationID, SectorID: historySector(actor)})
	if err != nil {
		return nil, fmt.Errorf("list organization tickets: %w", err)
	}
	out := make([]HistoryEntry, len(rows))
	for i, r := range rows {
		out[i] = HistoryEntry(r)
	}
	return out, nil
}
