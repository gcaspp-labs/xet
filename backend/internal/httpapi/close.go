package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type closingFormResponse struct {
	Modules      []ticketUserResponse `json:"modules"`
	Organization *ticketUserResponse  `json:"organization"`
	StartedAt    time.Time            `json:"startedAt"`
}

// closingForm returns what the closing form starts with: the active modules
// of the sector, the suggested organization and the automatic start.
func (s *server) closingForm(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	form, err := s.tickets.ClosingForm(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := closingFormResponse{Modules: make([]ticketUserResponse, len(form.Modules)), StartedAt: form.StartedAt}
	for i, m := range form.Modules {
		out.Modules[i] = ticketUserResponse{ID: m.ID, Name: m.Name}
	}
	if o := form.Organization; o != nil {
		out.Organization = &ticketUserResponse{ID: o.ID, Name: o.Name}
	}
	writeJSON(w, http.StatusOK, out)
}

type closeRequest struct {
	Subject        string     `json:"subject" validate:"required,max=500"`
	Resolution     string     `json:"resolution" validate:"required,max=10000"`
	ModuleIDs      []int64    `json:"moduleIds" validate:"required,min=1,max=100"`
	OrganizationID int64      `json:"organizationId" validate:"required"`
	StartedAt      *time.Time `json:"startedAt"`
	EndedAt        *time.Time `json:"endedAt"`
}

func (req closeRequest) closing() ticket.Closing {
	return ticket.Closing{
		Subject: req.Subject, Resolution: req.Resolution, ModuleIDs: req.ModuleIDs,
		OrganizationID: req.OrganizationID, StartedAt: req.StartedAt, EndedAt: req.EndedAt,
	}
}

type closeResponse struct {
	ID        int64      `json:"id"`
	Status    string     `json:"status"`
	StartedAt time.Time  `json:"startedAt"`
	EndedAt   *time.Time `json:"endedAt"`
	ClosedAt  *time.Time `json:"closedAt"`
}

// closeTicket saves the closing form and closes the ticket.
func (s *server) closeTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req closeRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.Close(r.Context(), currentUser(r.Context()), ticketID, req.closing())
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ticket.ErrNotAssignee):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode encerrá-lo.")
	case errors.Is(err, ticket.ErrNotInProgress):
		writeError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de encerrar.")
	case errors.Is(err, ticket.ErrContactNotRegistered):
		writeError(w, http.StatusUnprocessableEntity, "Cadastre o contato e vincule-o a um órgão antes de encerrar.")
	default:
		s.closingError(w, r, err)
	}
}

// listTicketModules returns the modules recorded when the ticket was closed.
func (s *server) listTicketModules(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.Modules(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]ticketUserResponse, len(rows))
	for i, m := range rows {
		out[i] = ticketUserResponse{ID: m.ID, Name: m.Name}
	}
	writeJSON(w, http.StatusOK, out)
}
