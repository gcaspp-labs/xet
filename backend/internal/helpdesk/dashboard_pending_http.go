package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// dashboardPendingContact is the contact of a pending row: only who the board
// shows on the line, without the rest of the contact record.
type dashboardPendingContact struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// dashboardPendingTicketResponse is a pending ticket of the Dashboard board: the
// contact, the reason and since when it waits, and the sector, for the admin who
// sees every sector (#342, spec #332).
type dashboardPendingTicketResponse struct {
	ID        int64                   `json:"id"`
	Protocol  string                  `json:"protocol"`
	Contact   dashboardPendingContact `json:"contact"`
	Reason    *string                 `json:"reason"`
	PendingAt *time.Time              `json:"pendingAt"`
	Sector    httpx.Ref               `json:"sector"`
}

// dashboardPending is the Pendentes board of the Dashboard: how many tickets are
// pending now and the 10 waiting for longer, oldest first. The period of the
// numbers does not change it; the sector does, as in the rest of the Dashboard
// (dashboard.md, rules 1 and 2).
func (h *Handler) dashboardPending(w http.ResponseWriter, r *http.Request) {
	sector, ok := dashboardFilterID(r, "sectorId")
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	}
	filter, err := h.service.checkDashboardFilter(r.Context(), auth.CurrentUser(r.Context()), DashboardFilter{SectorID: sector})
	switch {
	case errors.Is(err, ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
		return
	case errors.Is(err, ErrInvalidDashboardFilter):
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	case err != nil:
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	count, err := h.service.q.CountDashboardPendingTickets(r.Context(), filter.SectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	rows, err := h.service.q.ListDashboardPendingTickets(r.Context(), filter.SectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := struct {
		Count   int64                            `json:"count"`
		Tickets []dashboardPendingTicketResponse `json:"tickets"`
	}{Count: count, Tickets: make([]dashboardPendingTicketResponse, 0, len(rows))}
	for _, row := range rows {
		out.Tickets = append(out.Tickets, dashboardPendingTicketResponse{
			ID: row.ID, Protocol: row.Protocol,
			Contact:   dashboardPendingContact{ID: row.ContactID, Name: row.ContactName},
			Reason:    row.PendingReason,
			PendingAt: row.PendingAt,
			Sector:    httpx.Ref{ID: row.SectorID, Name: row.SectorName},
		})
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
