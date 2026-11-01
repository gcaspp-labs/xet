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

// closingError answers the errors of the closing form, shared by the
// closing, the transfer between sectors and the correction.
func (s *server) closingError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrIncompleteClosing):
		writeError(w, http.StatusUnprocessableEntity, "Preencha o assunto, a resolução e ao menos um módulo.")
	case errors.Is(err, ticket.ErrInvalidOrganization):
		writeError(w, http.StatusUnprocessableEntity, "Escolha um órgão cadastrado.")
	case errors.Is(err, ticket.ErrInvalidModules):
		writeError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos do setor do chamado.")
	case errors.Is(err, ticket.ErrInvalidPeriod):
		writeError(w, http.StatusUnprocessableEntity, "O fim precisa ser depois do início e não pode estar no futuro.")
	default:
		s.ticketError(w, r, err)
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

type transferSectorRequest struct {
	closeRequest
	SectorID int64 `json:"sectorId" validate:"required"`
}

type transferSectorResponse struct {
	ID       int64  `json:"id"`
	Protocol string `json:"protocol"`
}

// transferSector saves the closing form, closes the ticket as transferred
// and opens the linked ticket in the queue of the target sector.
func (s *server) transferSector(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req transferSectorRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	next, err := s.tickets.TransferSector(r.Context(), currentUser(r.Context()), ticketID, req.SectorID, req.closing())
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, transferSectorResponse{ID: next.ID, Protocol: next.Protocol})
	case errors.Is(err, ticket.ErrNotAssignee):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode transferi-lo para outro setor.")
	case errors.Is(err, ticket.ErrNotInProgress):
		writeError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de transferir.")
	case errors.Is(err, ticket.ErrInvalidSector):
		writeError(w, http.StatusUnprocessableEntity, "Escolha outro setor ativo.")
	case errors.Is(err, ticket.ErrOpenInSector):
		writeError(w, http.StatusConflict, "O contato já tem chamado aberto no setor de destino. Nada foi transferido.")
	case errors.Is(err, ticket.ErrContactNotRegistered):
		writeError(w, http.StatusUnprocessableEntity, "Cadastre o contato e vincule-o a um órgão antes de transferir.")
	default:
		s.closingError(w, r, err)
	}
}

// listTransferSectors returns the sectors the ticket may be transferred to.
func (s *server) listTransferSectors(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	sectors, err := s.tickets.TransferSectors(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]ticketUserResponse, len(sectors))
	for i, sec := range sectors {
		out[i] = ticketUserResponse{ID: sec.ID, Name: sec.Name}
	}
	writeJSON(w, http.StatusOK, out)
}
