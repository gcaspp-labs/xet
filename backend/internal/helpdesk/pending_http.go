package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type pendingRequest struct {
	Reason string `json:"reason" validate:"max=2000"`
}

type pendingResponse struct {
	ID         int64           `json:"id"`
	Status     db.TicketStatus `json:"status"`
	AssigneeID *int64          `json:"assigneeId"`
	Reason     *string         `json:"reason"`
	PendingAt  *time.Time      `json:"pendingAt"`
}

// markPending sets a ticket in progress aside as pending, with a reason.
func (h *Handler) markPending(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req pendingRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.MarkPending(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.Reason)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, pendingResponse{
			ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, Reason: t.PendingReason, PendingAt: t.PendingAt,
		})
	case errors.Is(err, ErrReasonRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o motivo do pendente.")
	case errors.Is(err, ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de colocá-lo como pendente.")
	case errors.Is(err, ErrNotAssignee):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode colocá-lo como pendente.")
	default:
		h.ticketError(w, r, err)
	}
}
