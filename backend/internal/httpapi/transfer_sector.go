package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

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
