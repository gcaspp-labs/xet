package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type correctRequest struct {
	Subject        string    `json:"subject" validate:"required,max=500"`
	Resolution     string    `json:"resolution" validate:"required,max=10000"`
	ModuleIDs      []int64   `json:"moduleIds" validate:"required,min=1,max=100"`
	OrganizationID int64     `json:"organizationId" validate:"required"`
	StartedAt      time.Time `json:"startedAt" validate:"required"`
	EndedAt        time.Time `json:"endedAt" validate:"required"`
	SpokeWith      string    `json:"spokeWith" validate:"max=200"`
	Reason         string    `json:"reason" validate:"max=2000"`
}

// correctTicket corrects the closing data of a closed ticket, with a reason.
func (h *Handler) correctTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req correctRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := h.service.Correct(r.Context(), auth.CurrentUser(r.Context()), ticketID, Correction(req))
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ErrCannotCorrect):
		httpx.WriteError(w, http.StatusForbidden, "Apenas quem encerrou o atendimento e a supervisão do setor podem corrigi-lo.")
	case errors.Is(err, ErrNotClosed):
		httpx.WriteError(w, http.StatusConflict, "Só atendimentos encerrados são corrigidos.")
	case errors.Is(err, ErrCancelled):
		httpx.WriteError(w, http.StatusConflict, "Chamado cancelado não é corrigido.")
	case errors.Is(err, ErrReasonRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o motivo da correção.")
	case errors.Is(err, ErrNoChanges):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Nenhum dado foi alterado.")
	default:
		h.closingError(w, r, err)
	}
}

type fieldChangeResponse struct {
	Field string `json:"field"`
	From  any    `json:"from"`
	To    any    `json:"to"`
}

type correctionResponse struct {
	ID        int64                 `json:"id"`
	CreatedAt time.Time             `json:"createdAt"`
	Actor     *httpx.Ref            `json:"actor"`
	Reason    string                `json:"reason"`
	Changes   []fieldChangeResponse `json:"changes"`
}

// listCorrections returns the history of changes of a closed ticket.
func (h *Handler) listCorrections(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	logs, err := h.service.Corrections(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := make([]correctionResponse, len(logs))
	for i, l := range logs {
		out[i] = correctionResponse{ID: l.ID, CreatedAt: l.CreatedAt, Reason: l.Reason, Changes: make([]fieldChangeResponse, len(l.Changes))}
		if l.ActorID != nil && l.ActorName != nil {
			out[i].Actor = &httpx.Ref{ID: *l.ActorID, Name: *l.ActorName}
		}
		for j, c := range l.Changes {
			out[i].Changes[j] = fieldChangeResponse(c)
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
