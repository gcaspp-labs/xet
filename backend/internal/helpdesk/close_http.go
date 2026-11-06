package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// formSubjectResponse is a subject of the closing form with its solutions.
type formSubjectResponse struct {
	ID        int64              `json:"id"`
	Name      string             `json:"name"`
	Solutions []solutionResponse `json:"solutions"`
}

type closingFormResponse struct {
	Modules          []httpx.Ref            `json:"modules"`
	Subjects         []formSubjectResponse  `json:"subjects"`
	ContactModuleIDs []int64                `json:"contactModuleIds"`
	Organization     *httpx.OrganizationRef `json:"organization"`
	StartedAt        time.Time              `json:"startedAt"`
}

// closingForm returns what the closing form starts with: the active modules
// and the subjects of the sector with their solutions, the modules of the
// contact among them, the suggested organization and the automatic start.
func (h *Handler) closingForm(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	form, err := h.service.ClosingForm(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := closingFormResponse{
		Modules:          make([]httpx.Ref, len(form.Modules)),
		Subjects:         make([]formSubjectResponse, len(form.Subjects)),
		ContactModuleIDs: append([]int64{}, form.ContactModuleIDs...),
		StartedAt:        form.StartedAt,
	}
	for i, m := range form.Modules {
		out.Modules[i] = httpx.Ref{ID: m.ID, Name: m.Name}
	}
	for i, s := range form.Subjects {
		out.Subjects[i] = formSubjectResponse{ID: s.ID, Name: s.Name, Solutions: toSolutionResponses(s.Solutions)}
	}
	if o := form.Organization; o != nil {
		out.Organization = &httpx.OrganizationRef{
			ID: o.Organization.ID, Name: o.Organization.Name,
			Municipality: httpx.Ref{ID: o.Organization.MunicipalityID, Name: o.MunicipalityName},
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// closeRequest has no limit on the subject: a text over the limit of the list
// does not enter it, and the form is still saved (spec.md, Assuntos e soluções).
type closeRequest struct {
	Subject        string     `json:"subject" validate:"required"`
	Resolution     string     `json:"resolution" validate:"required,max=10000"`
	ModuleIDs      []int64    `json:"moduleIds" validate:"required,min=1,max=100"`
	OrganizationID int64      `json:"organizationId" validate:"required"`
	StartedAt      *time.Time `json:"startedAt"`
	EndedAt        *time.Time `json:"endedAt"`
	AddSubject     bool       `json:"addSubject"`
	AddSolution    bool       `json:"addSolution"`
}

func (req closeRequest) closing() Closing {
	return Closing(req)
}

type closeResponse struct {
	ID        int64      `json:"id"`
	Status    string     `json:"status"`
	StartedAt time.Time  `json:"startedAt"`
	EndedAt   *time.Time `json:"endedAt"`
	ClosedAt  *time.Time `json:"closedAt"`
}

// closeTicket saves the closing form and closes the ticket.
func (h *Handler) closeTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req closeRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.Close(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.closing())
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ErrNotAssignee):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode encerrá-lo.")
	case errors.Is(err, ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de encerrar.")
	case errors.Is(err, ErrContactNotRegistered):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Cadastre o contato e vincule-o a um órgão antes de encerrar.")
	default:
		h.closingError(w, r, err)
	}
}

// listTicketModules returns the modules recorded when the ticket was closed.
func (h *Handler) listTicketModules(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	rows, err := h.service.Modules(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := make([]httpx.Ref, len(rows))
	for i, m := range rows {
		out[i] = httpx.Ref{ID: m.ID, Name: m.Name}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
