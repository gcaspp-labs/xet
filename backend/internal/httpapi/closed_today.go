package httpapi

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type closedTicketResponse struct {
	ID               int64                 `json:"id"`
	Protocol         string                `json:"protocol"`
	ClosureType      db.ClosureType        `json:"closureType"`
	ClosedAt         *time.Time            `json:"closedAt"`
	Contact          ticketContactResponse `json:"contact"`
	OrganizationName *string               `json:"organizationName"`
	ClosedBy         httpx.Ref             `json:"closedBy"`
}

// listClosedToday returns the tickets of the sector closed today, for the
// list of completed services in the panel.
func (s *server) listClosedToday(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.ClosedToday(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(s.logger, w, r, err)
		return
	}
	out := make([]closedTicketResponse, len(rows))
	for i, t := range rows {
		out[i] = closedTicketResponse{
			ID:          t.ID,
			Protocol:    t.Protocol,
			ClosureType: t.ClosureType.ClosureType,
			ClosedAt:    t.ClosedAt,
			Contact: ticketContactResponse{
				ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered,
			},
			OrganizationName: t.OrganizationName,
			ClosedBy:         httpx.Ref{ID: *t.ClosedByID, Name: t.ClosedByName},
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
