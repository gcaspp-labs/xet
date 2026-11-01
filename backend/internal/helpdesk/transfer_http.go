package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type transferRequest struct {
	AssigneeID int64 `json:"assigneeId" validate:"required"`
}

// transferTicket hands a ticket in progress to another user of its sector.
func (h *Handler) transferTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req transferRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.Transfer(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.AssigneeID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.Is(err, ErrCannotTransfer):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode transferi-lo.")
	case errors.Is(err, ErrNotInProgress):
		httpx.WriteError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de transferir.")
	case errors.Is(err, ErrInvalidTarget):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha um atendente ativo do setor do chamado.")
	default:
		h.ticketError(w, r, err)
	}
}

type assignmentLogResponse struct {
	ID        int64      `json:"id"`
	Action    string     `json:"action"`
	CreatedAt time.Time  `json:"createdAt"`
	Actor     *httpx.Ref `json:"actor"`
	FromName  *string    `json:"fromName"`
	ToName    *string    `json:"toName"`
	// ToSectorName is the target of a transfer between sectors.
	ToSectorName *string `json:"toSectorName"`
	// Reason is the one given for a cancellation or a correction.
	Reason *string `json:"reason"`
}

// listAssignments returns when the ticket was assigned and each transfer,
// shown among the messages of the conversation.
func (h *Handler) listAssignments(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	rows, err := h.service.AssignmentLogs(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := make([]assignmentLogResponse, len(rows))
	for i, l := range rows {
		out[i] = assignmentLogResponse{ID: l.ID, Action: l.Action, CreatedAt: l.CreatedAt, FromName: l.FromName, ToName: l.ToName, ToSectorName: l.ToSectorName, Reason: l.Reason}
		if l.ActorID != nil && l.ActorName != nil {
			out[i].Actor = &httpx.Ref{ID: *l.ActorID, Name: *l.ActorName}
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
