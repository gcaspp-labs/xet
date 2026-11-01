package httpapi

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type historyResponse struct {
	ID               int64           `json:"id"`
	Protocol         string          `json:"protocol"`
	Status           db.TicketStatus `json:"status"`
	SectorName       string          `json:"sectorName"`
	ArrivedAt        time.Time       `json:"arrivedAt"`
	ClosedAt         *time.Time      `json:"closedAt"`
	Subject          *string         `json:"subject"`
	ContactName      string          `json:"contactName"`
	OrganizationName *string         `json:"organizationName"`
	AssigneeName     *string         `json:"assigneeName"`
}

func writeHistory(w http.ResponseWriter, rows []ticket.HistoryEntry) {
	out := make([]historyResponse, len(rows))
	for i, t := range rows {
		out[i] = historyResponse{
			ID: t.ID, Protocol: t.Protocol, Status: t.Status, SectorName: t.SectorName,
			ArrivedAt: t.ArrivedAt, ClosedAt: t.ClosedAt, Subject: t.Subject,
			ContactName: t.ContactName, OrganizationName: t.OrganizationName, AssigneeName: t.AssigneeName,
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// contactHistory lists the tickets of the contact in the sectors of the user.
func (s *server) contactHistory(w http.ResponseWriter, r *http.Request) {
	contactID, ok := urlID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.ContactHistory(r.Context(), currentUser(r.Context()), contactID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeHistory(w, rows)
}

// organizationHistory lists the tickets of the organization in the sectors of the user.
func (s *server) organizationHistory(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := urlID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.OrganizationHistory(r.Context(), currentUser(r.Context()), organizationID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeHistory(w, rows)
}
