package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type closedTicketResponse struct {
	ID               int64                 `json:"id"`
	Protocol         string                `json:"protocol"`
	ClosureType      *db.ClosureType       `json:"closureType"`
	Channel          db.TicketChannel      `json:"channel"`
	ClosedAt         *time.Time            `json:"closedAt"`
	Subject          *string               `json:"subject"`
	Contact          ticketContactResponse `json:"contact"`
	OrganizationName *string               `json:"organizationName"`
	MunicipalityName *string               `json:"municipalityName"`
	Sector           httpx.Ref             `json:"sector"`
	Assignee         *httpx.Ref            `json:"assignee"`
	// TransferredTo is the sector a transferred ticket went to.
	TransferredTo *httpx.Ref `json:"transferredTo"`
	Modules       []string   `json:"modules"`
}

// closedTicketsFilter reads ?q=, ?period= (today, 7d or 30d) or ?from= and ?to=
// (YYYY-MM-DD, either may be missing), ?sectorId=, ?assigneeId=, ?module= and
// ?subject= (the last two are texts the name contains). Without a period, it is every period. A situation is refused: the
// history only has closed tickets.
func closedTicketsFilter(w http.ResponseWriter, r *http.Request) (ClosedTicketsFilter, bool) {
	query := r.URL.Query()
	if query.Has("status") || query.Has("situation") || query.Has("closureType") {
		httpx.WriteError(w, http.StatusBadRequest, "A lista só tem chamados encerrados: não há filtro de situação.")
		return ClosedTicketsFilter{}, false
	}
	filter := ClosedTicketsFilter{Search: query.Get("q"), Module: query.Get("module"), Subject: query.Get("subject")}

	period, rawFrom, rawTo := query.Get("period"), query.Get("from"), query.Get("to")
	switch {
	case period != "" && (rawFrom != "" || rawTo != ""):
		httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
		return filter, false
	case period != "":
		from, to, ok := DashboardDays(DashboardPeriod(period))
		if !ok {
			httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
			return filter, false
		}
		until := to.AddDate(0, 0, 1)
		filter.ClosedFrom, filter.ClosedUntil = &from, &until
	default:
		if rawFrom != "" {
			from, err := ParseDashboardDay(rawFrom)
			if err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
				return filter, false
			}
			filter.ClosedFrom = &from
		}
		if rawTo != "" {
			to, err := ParseDashboardDay(rawTo)
			if err != nil {
				httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
				return filter, false
			}
			until := to.AddDate(0, 0, 1)
			filter.ClosedUntil = &until
		}
		if filter.ClosedFrom != nil && filter.ClosedUntil != nil && !filter.ClosedFrom.Before(*filter.ClosedUntil) {
			httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
			return filter, false
		}
	}

	var okSector, okAssignee bool
	filter.SectorID, okSector = dashboardFilterID(r, "sectorId")
	filter.AssigneeID, okAssignee = dashboardFilterID(r, "assigneeId")
	if !okSector || !okAssignee {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return filter, false
	}
	return filter, true
}

// writeClosedTicketsError answers the errors of the scope and the filters.
func (h *Handler) writeClosedTicketsError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	case errors.Is(err, ErrInvalidDashboardFilter):
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}

// listClosedTickets is the history of Atendimentos: the closed tickets of the
// sectors of the user, with search, filters, order and page on the server.
func (h *Handler) listClosedTickets(w http.ResponseWriter, r *http.Request) {
	filter, ok := closedTicketsFilter(w, r)
	if !ok {
		return
	}
	rows, total, page, err := h.service.ClosedTickets(r.Context(), auth.CurrentUser(r.Context()), filter, paging.Parse(r, ClosedTicketSortColumns, "date", true))
	if err != nil {
		h.writeClosedTicketsError(w, r, err)
		return
	}
	out := make([]closedTicketResponse, len(rows))
	for i, t := range rows {
		item := closedTicketResponse{
			ID: t.ID, Protocol: t.Protocol, Channel: t.Channel, ClosedAt: t.ClosedAt, Subject: t.Subject,
			Contact: ticketContactResponse{
				ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered,
			},
			OrganizationName: t.OrganizationName, MunicipalityName: t.MunicipalityName,
			Sector:  httpx.Ref{ID: t.SectorID, Name: t.SectorName},
			Modules: t.ModuleNames,
		}
		if item.Modules == nil {
			item.Modules = []string{}
		}
		if t.ClosureType.Valid {
			item.ClosureType = &t.ClosureType.ClosureType
		}
		if t.AssigneeID != nil && t.AssigneeName != nil {
			item.Assignee = &httpx.Ref{ID: *t.AssigneeID, Name: *t.AssigneeName}
		}
		if t.TransferredSectorID != nil && t.TransferredSectorName != nil {
			item.TransferredTo = &httpx.Ref{ID: *t.TransferredSectorID, Name: *t.TransferredSectorName}
		}
		out[i] = item
	}
	httpx.WriteJSON(w, http.StatusOK, paging.NewPage(out, total, page))
}

type closedTicketOption struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

// closedTicketFilterOptions returns the assignees and modules of the sector, for
// the filters of the history.
func (h *Handler) closedTicketFilterOptions(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := dashboardFilterID(r, "sectorId")
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	}
	options, err := h.service.ClosedTicketFilterOptions(r.Context(), auth.CurrentUser(r.Context()), sectorID)
	if err != nil {
		h.writeClosedTicketsError(w, r, err)
		return
	}
	out := struct {
		Assignees []closedTicketOption `json:"assignees"`
		Modules   []closedTicketOption `json:"modules"`
	}{Assignees: make([]closedTicketOption, len(options.Assignees)), Modules: make([]closedTicketOption, len(options.Modules))}
	for i, a := range options.Assignees {
		out.Assignees[i] = closedTicketOption{ID: a.ID, Name: a.Name, Active: a.Active}
	}
	for i, m := range options.Modules {
		out.Modules[i] = closedTicketOption{ID: m.ID, Name: m.Name, Active: m.Active}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// listClosedTicketSubjects suggests subjects that contain ?q=, for the filter of
// the history.
func (h *Handler) listClosedTicketSubjects(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := dashboardFilterID(r, "sectorId")
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	}
	subjects, err := h.service.ClosedTicketSubjects(r.Context(), auth.CurrentUser(r.Context()), sectorID, r.URL.Query().Get("q"))
	if err != nil {
		h.writeClosedTicketsError(w, r, err)
		return
	}
	if subjects == nil {
		subjects = []string{}
	}
	httpx.WriteJSON(w, http.StatusOK, subjects)
}
