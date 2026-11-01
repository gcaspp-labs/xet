package helpdesk

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type historyResponse struct {
	ID               int64           `json:"id"`
	Protocol         string          `json:"protocol"`
	Status           db.TicketStatus `json:"status"`
	ClosureType      *db.ClosureType `json:"closureType"`
	SectorName       string          `json:"sectorName"`
	ArrivedAt        time.Time       `json:"arrivedAt"`
	ClosedAt         *time.Time      `json:"closedAt"`
	Subject          *string         `json:"subject"`
	ContactName      string          `json:"contactName"`
	OrganizationName *string         `json:"organizationName"`
	AssigneeName     *string         `json:"assigneeName"`
}

func writeHistory(w http.ResponseWriter, rows []HistoryEntry) {
	out := make([]historyResponse, len(rows))
	for i, t := range rows {
		out[i] = historyResponse{
			ID: t.ID, Protocol: t.Protocol, Status: t.Status, SectorName: t.SectorName,
			ArrivedAt: t.ArrivedAt, ClosedAt: t.ClosedAt, Subject: t.Subject,
			ContactName: t.ContactName, OrganizationName: t.OrganizationName, AssigneeName: t.AssigneeName,
		}
		if t.ClosureType.Valid {
			out[i].ClosureType = &t.ClosureType.ClosureType
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// contactHistory lists the tickets of the contact in the sectors of the user.
func (h *Handler) contactHistory(w http.ResponseWriter, r *http.Request) {
	contactID, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	rows, err := h.service.ContactHistory(r.Context(), auth.CurrentUser(r.Context()), contactID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	writeHistory(w, rows)
}

// organizationHistory lists the tickets of the organization in the sectors of the user.
func (h *Handler) organizationHistory(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := httpx.URLID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	rows, err := h.service.OrganizationHistory(r.Context(), auth.CurrentUser(r.Context()), organizationID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	writeHistory(w, rows)
}
