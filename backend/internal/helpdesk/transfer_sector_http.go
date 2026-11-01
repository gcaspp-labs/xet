package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
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
func (h *Handler) transferSector(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req transferSectorRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	next, err := h.service.TransferSector(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.SectorID, req.closing())
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, transferSectorResponse{ID: next.ID, Protocol: next.Protocol})
	case errors.Is(err, ErrNotAssignee):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode transferi-lo para outro setor.")
	case errors.Is(err, ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de transferir.")
	case errors.Is(err, ErrInvalidSector):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha outro setor ativo.")
	case errors.Is(err, ErrOpenInSector):
		httpx.WriteError(w, http.StatusConflict, "O contato já tem chamado aberto no setor de destino. Nada foi transferido.")
	case errors.Is(err, ErrContactNotRegistered):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Cadastre o contato e vincule-o a um órgão antes de transferir.")
	default:
		h.closingError(w, r, err)
	}
}

// listTransferSectors returns the sectors the ticket may be transferred to.
func (h *Handler) listTransferSectors(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	sectors, err := h.service.TransferSectors(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := make([]httpx.Ref, len(sectors))
	for i, sec := range sectors {
		out[i] = httpx.Ref{ID: sec.ID, Name: sec.Name}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
