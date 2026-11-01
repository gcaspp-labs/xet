package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// returnTicket takes a ticket in progress back to the queue of its sector.
func (h *Handler) returnTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := h.service.ReturnToQueue(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.Is(err, ErrCannotReturn):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode devolvê-lo à fila.")
	case errors.Is(err, ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já está na fila.")
	default:
		h.ticketError(w, r, err)
	}
}
