package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type cancelRequest struct {
	Reason string `json:"reason" validate:"max=2000"`
}

// cancelTicket finishes an open ticket without recording a service, with a reason.
func (h *Handler) cancelTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req cancelRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.Cancel(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.Reason)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ErrCannotCancel):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode cancelá-lo.")
	case errors.Is(err, ErrReasonRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o motivo do cancelamento.")
	default:
		h.ticketError(w, r, err)
	}
}
