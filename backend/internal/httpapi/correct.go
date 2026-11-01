package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
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
func (s *server) correctTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req correctRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.Correct(r.Context(), currentUser(r.Context()), ticketID, ticket.Correction{
		Subject: req.Subject, Resolution: req.Resolution, ModuleIDs: req.ModuleIDs, OrganizationID: req.OrganizationID,
		StartedAt: req.StartedAt, EndedAt: req.EndedAt, SpokeWith: req.SpokeWith, Reason: req.Reason,
	})
	switch {
	case err == nil:
		writeJSON(w, http.StatusOK, closeResponse{ID: t.ID, Status: string(t.Status), StartedAt: t.StartedAt, EndedAt: t.EndedAt, ClosedAt: t.ClosedAt})
	case errors.Is(err, ticket.ErrCannotCorrect):
		writeError(w, http.StatusForbidden, "Apenas quem encerrou o atendimento e a supervisão do setor podem corrigi-lo.")
	case errors.Is(err, ticket.ErrNotClosed):
		writeError(w, http.StatusConflict, "Só atendimentos encerrados são corrigidos.")
	case errors.Is(err, ticket.ErrReasonRequired):
		writeError(w, http.StatusUnprocessableEntity, "Informe o motivo da correção.")
	case errors.Is(err, ticket.ErrNoChanges):
		writeError(w, http.StatusUnprocessableEntity, "Nenhum dado foi alterado.")
	default:
		s.closingError(w, r, err)
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
	Actor     *ticketUserResponse   `json:"actor"`
	Reason    string                `json:"reason"`
	Changes   []fieldChangeResponse `json:"changes"`
}

// listCorrections returns the history of changes of a closed ticket.
func (s *server) listCorrections(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	logs, err := s.tickets.Corrections(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]correctionResponse, len(logs))
	for i, l := range logs {
		out[i] = correctionResponse{ID: l.ID, CreatedAt: l.CreatedAt, Reason: l.Reason, Changes: make([]fieldChangeResponse, len(l.Changes))}
		if l.ActorID != nil && l.ActorName != nil {
			out[i].Actor = &ticketUserResponse{ID: *l.ActorID, Name: *l.ActorName}
		}
		for j, c := range l.Changes {
			out[i].Changes[j] = fieldChangeResponse{Field: c.Field, From: c.From, To: c.To}
		}
	}
	writeJSON(w, http.StatusOK, out)
}
