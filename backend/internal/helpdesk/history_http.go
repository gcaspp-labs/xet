package helpdesk

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
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
	MunicipalityName *string         `json:"municipalityName"`
	AssigneeName     *string         `json:"assigneeName"`
}

func writeHistory(w http.ResponseWriter, rows []HistoryEntry, total int64, page paging.Request) {
	out := make([]historyResponse, len(rows))
	for i, t := range rows {
		out[i] = historyResponse{
			ID: t.ID, Protocol: t.Protocol, Status: t.Status, SectorName: t.SectorName,
			ArrivedAt: t.ArrivedAt, ClosedAt: t.ClosedAt, Subject: t.Subject,
			ContactName: t.ContactName, OrganizationName: t.OrganizationName, MunicipalityName: t.MunicipalityName, AssigneeName: t.AssigneeName,
		}
		if t.ClosureType.Valid {
			out[i].ClosureType = &t.ClosureType.ClosureType
		}
	}
	httpx.WriteJSON(w, http.StatusOK, paging.NewPage(out, total, page))
}

// contactHistory lists the tickets of the contact in the sectors of the user.
func (h *Handler) contactHistory(w http.ResponseWriter, r *http.Request) {
	contactID, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	rows, total, page, err := h.service.ContactHistory(r.Context(), auth.CurrentUser(r.Context()), contactID, paging.Parse(r, HistorySortColumns, "arrived", true))
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	writeHistory(w, rows, total, page)
}

// organizationHistory lists the tickets of the organization in the sectors of the user.
func (h *Handler) organizationHistory(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := httpx.URLID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	rows, total, page, err := h.service.OrganizationHistory(r.Context(), auth.CurrentUser(r.Context()), organizationID, paging.Parse(r, HistorySortColumns, "arrived", true))
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	writeHistory(w, rows, total, page)
}
