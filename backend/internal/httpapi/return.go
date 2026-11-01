package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

// returnTicket takes a ticket in progress back to the queue of its sector.
func (s *server) returnTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := s.tickets.ReturnToQueue(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.Is(err, ticket.ErrCannotReturn):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode devolvê-lo à fila.")
	case errors.Is(err, ticket.ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já está na fila.")
	default:
		s.ticketError(w, r, err)
	}
}
