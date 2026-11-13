package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type dashboardTicketResponse struct {
	ticketSummaryResponse
	Sector httpx.Ref `json:"sector"`
}

func (h *Handler) dashboardTickets(w http.ResponseWriter, r *http.Request) {
	sector, a := dashboardFilterID(r, "sectorId")
	assignee, b := dashboardFilterID(r, "assigneeId")
	organization, c := dashboardFilterID(r, "organizationId")
	if !a || !b || !c {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	}
	filter, err := h.service.checkDashboardFilter(r.Context(), auth.CurrentUser(r.Context()), DashboardFilter{SectorID: sector, AssigneeID: assignee, OrganizationID: organization})
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
	rows, err := h.service.q.ListDashboardTickets(r.Context(), db.ListDashboardTicketsParams{SectorID: filter.SectorID, AssigneeID: filter.AssigneeID, OrganizationID: filter.OrganizationID})
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := struct {
		Queued     []dashboardTicketResponse `json:"queued"`
		InProgress []dashboardTicketResponse `json:"inProgress"`
	}{Queued: []dashboardTicketResponse{}, InProgress: []dashboardTicketResponse{}}
	for _, row := range rows {
		ticket := dashboardTicketResponse{
			ticketSummaryResponse: ticketSummaryResponse{
				ID: row.ID, Protocol: row.Protocol, Status: row.Status, ArrivedAt: row.ArrivedAt, AssignedAt: row.AssignedAt,
				Contact:          ticketContactResponse{ID: row.ContactID, Name: row.ContactName, Phone: row.ContactPhone, Registered: row.ContactRegistered},
				OrganizationName: row.OrganizationName, MunicipalityName: row.MunicipalityName,
			},
			Sector: httpx.Ref{ID: row.SectorID, Name: row.SectorName},
		}
		if row.AssigneeID != nil && row.AssigneeName != nil {
			ticket.Assignee = &httpx.Ref{ID: *row.AssigneeID, Name: *row.AssigneeName}
		}
		if row.Status == db.TicketStatusQueued {
			out.Queued = append(out.Queued, ticket)
		} else {
			out.InProgress = append(out.InProgress, ticket)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
