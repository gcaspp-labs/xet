package helpdesk

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// dashboardNumber tells "does not apply to the filter" (applicable false) from
// "no data" (applicable true and value null).
type dashboardNumber struct {
	Applicable bool   `json:"applicable"`
	Value      *int64 `json:"value"`
}

type dashboardPeriodResponse struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type dashboardNumbersResponse struct {
	Queued                 dashboardNumber `json:"queued"`
	InProgress             dashboardNumber `json:"inProgress"`
	Received               dashboardNumber `json:"received"`
	Started                dashboardNumber `json:"started"`
	Resolved               dashboardNumber `json:"resolved"`
	Transferred            dashboardNumber `json:"transferred"`
	Cancelled              dashboardNumber `json:"cancelled"`
	AverageWaitSeconds     dashboardNumber `json:"averageWaitSeconds"`
	AverageHandlingSeconds dashboardNumber `json:"averageHandlingSeconds"`
}

type dashboardAssigneeResponse struct {
	User                   httpx.Ref       `json:"user"`
	Sector                 httpx.Ref       `json:"sector"`
	InProgress             dashboardNumber `json:"inProgress"`
	Started                dashboardNumber `json:"started"`
	Resolved               dashboardNumber `json:"resolved"`
	Transferred            dashboardNumber `json:"transferred"`
	Cancelled              dashboardNumber `json:"cancelled"`
	AverageHandlingSeconds dashboardNumber `json:"averageHandlingSeconds"`
}

type dashboardResponse struct {
	Period    dashboardPeriodResponse     `json:"period"`
	SectorID  *int64                      `json:"sectorId"`
	Numbers   dashboardNumbersResponse    `json:"numbers"`
	Assignees []dashboardAssigneeResponse `json:"assignees"`
}

type dashboardAssigneeOption struct {
	ID     int64  `json:"id"`
	Name   string `json:"name"`
	Active bool   `json:"active"`
}

func toDashboardNumber(n DashboardNumber) dashboardNumber {
	return dashboardNumber(n)
}

// dashboardPeriod reads ?period= (today, 7d or 30d) or ?from= and ?to=
// (YYYY-MM-DD, both days included). Without any of them, it is today.
func dashboardPeriod(r *http.Request) (from, to time.Time, ok bool) {
	query := r.URL.Query()
	period, rawFrom, rawTo := query.Get("period"), query.Get("from"), query.Get("to")
	if rawFrom == "" && rawTo == "" {
		if period == "" {
			period = string(DashboardToday)
		}
		return DashboardDays(DashboardPeriod(period))
	}
	if period != "" || rawFrom == "" || rawTo == "" {
		return time.Time{}, time.Time{}, false
	}
	from, errFrom := ParseDashboardDay(rawFrom)
	to, errTo := ParseDashboardDay(rawTo)
	if errFrom != nil || errTo != nil || from.After(to) {
		return time.Time{}, time.Time{}, false
	}
	return from, to, true
}

// dashboardFilterID reads an optional ID of the query string.
func dashboardFilterID(r *http.Request, name string) (*int64, bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return nil, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return nil, false
	}
	return &id, true
}

// dashboard returns the numbers and the table of the dashboard, with the
// filters ?period= or ?from= and ?to=, ?sectorId=, ?assigneeId=, ?moduleId=
// and ?organizationId=.
func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	from, to, ok := dashboardPeriod(r)
	if !ok {
		httpx.WriteError(w, http.StatusBadRequest, "Período inválido.")
		return
	}
	sectorID, okSector := dashboardFilterID(r, "sectorId")
	assigneeID, okAssignee := dashboardFilterID(r, "assigneeId")
	moduleID, okModule := dashboardFilterID(r, "moduleId")
	organizationID, okOrganization := dashboardFilterID(r, "organizationId")
	if !okSector || !okAssignee || !okModule || !okOrganization {
		httpx.WriteError(w, http.StatusBadRequest, "Filtro inválido.")
		return
	}

	result, err := h.service.Dashboard(r.Context(), auth.CurrentUser(r.Context()), DashboardFilter{
		From: from, To: to, SectorID: sectorID, AssigneeID: assigneeID, ModuleID: moduleID, OrganizationID: organizationID,
	})
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

	n := result.Numbers
	out := dashboardResponse{
		Period:   dashboardPeriodResponse{From: from.Format(time.DateOnly), To: to.Format(time.DateOnly)},
		SectorID: result.Filter.SectorID,
		Numbers: dashboardNumbersResponse{
			Queued:                 toDashboardNumber(n.Queued),
			InProgress:             toDashboardNumber(n.InProgress),
			Received:               toDashboardNumber(n.Received),
			Started:                toDashboardNumber(n.Started),
			Resolved:               toDashboardNumber(n.Resolved),
			Transferred:            toDashboardNumber(n.Transferred),
			Cancelled:              toDashboardNumber(n.Cancelled),
			AverageWaitSeconds:     toDashboardNumber(n.AverageWait),
			AverageHandlingSeconds: toDashboardNumber(n.AverageHandling),
		},
		Assignees: make([]dashboardAssigneeResponse, len(result.Assignees)),
	}
	for i, a := range result.Assignees {
		out.Assignees[i] = dashboardAssigneeResponse{
			User:                   httpx.Ref{ID: a.UserID, Name: a.UserName},
			Sector:                 httpx.Ref{ID: a.SectorID, Name: a.SectorName},
			InProgress:             toDashboardNumber(a.InProgress),
			Started:                toDashboardNumber(a.Started),
			Resolved:               toDashboardNumber(a.Resolved),
			Transferred:            toDashboardNumber(a.Transferred),
			Cancelled:              toDashboardNumber(a.Cancelled),
			AverageHandlingSeconds: toDashboardNumber(a.AverageHandling),
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// listDashboardAssignees returns the options of the assignee filter of the sector.
func (h *Handler) listDashboardAssignees(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	rows, err := h.service.DashboardAssignees(r.Context(), sectorID)
	if errors.Is(err, ErrSectorNotFound) {
		httpx.WriteError(w, http.StatusNotFound, "Setor não encontrado.")
		return
	}
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]dashboardAssigneeOption, len(rows))
	for i, a := range rows {
		out[i] = dashboardAssigneeOption{ID: a.ID, Name: a.Name, Active: a.Active}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
