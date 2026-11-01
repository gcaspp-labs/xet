package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type cancelRequest struct {
	Reason string `json:"reason" validate:"max=2000"`
}

// cancelTicket finishes an open ticket without recording a service, with a reason.
func (s *server) cancelTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req cancelRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.Cancel(r.Context(), currentUser(r.Context()), ticketID, req.Reason)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ticket.ErrCannotCancel):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode cancelá-lo.")
	case errors.Is(err, ticket.ErrReasonRequired):
		writeError(w, http.StatusUnprocessableEntity, "Informe o motivo do cancelamento.")
	default:
		s.ticketError(w, r, err)
	}
}
