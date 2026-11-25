package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// mergeIntoPendingRequest chooses the pending ticket the closed one goes to.
type mergeIntoPendingRequest struct {
	PendingTicketID int64 `json:"pendingTicketId" validate:"required"`
}

// mergeIntoPendingResponse answers with the ticket A that received the closed
// one, which the screen opens in /atendimentos/<A>.
type mergeIntoPendingResponse struct {
	ID          int64           `json:"id"`
	Protocol    string          `json:"protocol"`
	Status      db.TicketStatus `json:"status"`
	ClosureType db.ClosureType  `json:"closureType"`
	AssigneeID  *int64          `json:"assigneeId"`
}

// mergeIntoPending merges a closed ticket into a pending one of the same
// contact and sector (#341, spec #332).
func (h *Handler) mergeIntoPending(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req mergeIntoPendingRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.MergeClosedIntoPending(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.PendingTicketID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, mergeIntoPendingResponse{
			ID: t.ID, Protocol: t.Protocol, Status: t.Status,
			ClosureType: t.ClosureType.ClosureType, AssigneeID: t.AssigneeID,
		})
	case errors.Is(err, ErrCannotCorrect):
		httpx.WriteError(w, http.StatusForbidden, "Apenas quem encerrou o atendimento e a supervisão do setor podem mesclá-lo num pendente.")
	case errors.Is(err, ErrPhoneNotMergeable):
		httpx.WriteError(w, http.StatusConflict, "Registro por telefone não pode ser mesclado em pendente.")
	case errors.Is(err, ErrPendingAfterClosed):
		httpx.WriteError(w, http.StatusConflict, "Este pendente começou depois deste atendimento. Escolha um pendente aberto antes do fim dele.")
	case errors.Is(err, ErrNotClosed):
		httpx.WriteError(w, http.StatusConflict, "Só um atendimento encerrado ou cancelado é mesclado num pendente.")
	case errors.Is(err, ErrTransferred):
		httpx.WriteError(w, http.StatusConflict, "Chamado transferido para outro setor não é mesclado num pendente.")
	case errors.Is(err, ErrMerged):
		httpx.WriteError(w, http.StatusConflict, "Chamado mesclado num pendente não é mesclado de novo.")
	case errors.Is(err, ErrNotPending):
		httpx.WriteError(w, http.StatusConflict, "Este chamado pendente não está mais pendente. Atualize a lista e tente novamente.")
	case errors.Is(err, ErrPendingMismatch):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha um chamado pendente do mesmo contato e setor.")
	default:
		h.ticketError(w, r, err)
	}
}

// mayMergeIntoPending tells whether the user may merge the closed ticket into a
// pending one (#341, spec #332): the same people who correct it, and only while
// its situation is resolved or cancelled and it was not registered by phone
// (mergeRefusal). The pending choices come only with it.
func mayMergeIntoPending(t db.GetTicketDetailRow, actor auth.User) bool {
	if t.Status != db.TicketStatusClosed || !t.ClosureType.Valid {
		return false
	}
	if mergeRefusal(t.Channel, t.ClosureType.ClosureType) != nil {
		return false
	}
	return mayCorrectCloser(t.ClosedByID, actor)
}
