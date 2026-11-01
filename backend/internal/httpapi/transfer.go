package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type transferRequest struct {
	AssigneeID int64 `json:"assigneeId" validate:"required"`
}

// transferTicket hands a ticket in progress to another user of its sector.
func (s *server) transferTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req transferRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.Transfer(r.Context(), currentUser(r.Context()), ticketID, req.AssigneeID)
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.Is(err, ticket.ErrCannotTransfer):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado ou a supervisão do setor pode transferi-lo.")
	case errors.Is(err, ticket.ErrNotInProgress):
		writeError(w, http.StatusConflict, "Este chamado está na fila. Assuma o chamado antes de transferir.")
	case errors.Is(err, ticket.ErrInvalidTarget):
		writeError(w, http.StatusUnprocessableEntity, "Escolha um atendente ativo do setor do chamado.")
	default:
		s.ticketError(w, r, err)
	}
}

type assignmentLogResponse struct {
	ID        int64               `json:"id"`
	Action    string              `json:"action"`
	CreatedAt time.Time           `json:"createdAt"`
	Actor     *ticketUserResponse `json:"actor"`
	FromName  *string             `json:"fromName"`
	ToName    *string             `json:"toName"`
	// ToSectorName is the target of a transfer between sectors.
	ToSectorName *string `json:"toSectorName"`
}

// listAssignments returns when the ticket was assigned and each transfer,
// shown among the messages of the conversation.
func (s *server) listAssignments(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.AssignmentLogs(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]assignmentLogResponse, len(rows))
	for i, l := range rows {
		out[i] = assignmentLogResponse{ID: l.ID, Action: l.Action, CreatedAt: l.CreatedAt, FromName: l.FromName, ToName: l.ToName, ToSectorName: l.ToSectorName}
		if l.ActorID != nil && l.ActorName != nil {
			out[i].Actor = &ticketUserResponse{ID: *l.ActorID, Name: *l.ActorName}
		}
	}
	writeJSON(w, http.StatusOK, out)
}
