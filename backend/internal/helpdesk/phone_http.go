package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// phoneTicketRequest is the closing form of a service given by phone, with
// the start and the end of the call and the idempotency key of the window.
type phoneTicketRequest struct {
	ContactID        int64      `json:"contactId"`
	OrganizationID   int64      `json:"organizationId" validate:"required"`
	ModuleIDs        []int64    `json:"moduleIds" validate:"required,min=1,max=100"`
	Subject          string     `json:"subject" validate:"required"`
	Resolution       string     `json:"resolution" validate:"required"`
	StartedAt        *time.Time `json:"startedAt" validate:"required"`
	EndedAt          *time.Time `json:"endedAt" validate:"required"`
	ClientRequestID  string     `json:"clientRequestId" validate:"required,uuid"`
	AddSubject       bool       `json:"addSubject"`
	SubjectModuleID  *int64     `json:"subjectModuleId"`
	SolutionModuleID *int64     `json:"solutionModuleId"`
	AddSolution      bool       `json:"addSolution"`
}

type phoneTicketResponse struct {
	ID       int64  `json:"id"`
	Protocol string `json:"protocol"`
}

// registerPhoneTicket records a service given by phone, born closed.
func (h *Handler) registerPhoneTicket(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req phoneTicketRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	if req.ContactID <= 0 {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha o contato.")
		return
	}
	var requestID pgtype.UUID
	if !parseRequestID(w, req.ClientRequestID, &requestID) {
		return
	}
	t, err := h.service.RegisterPhone(r.Context(), auth.CurrentUser(r.Context()), sectorID, requestID, PhoneRegistration{
		ContactID:        req.ContactID,
		OrganizationID:   req.OrganizationID,
		ModuleIDs:        req.ModuleIDs,
		Subject:          req.Subject,
		Resolution:       req.Resolution,
		StartedAt:        *req.StartedAt,
		EndedAt:          *req.EndedAt,
		AddSubject:       req.AddSubject,
		SubjectModuleID:  req.SubjectModuleID,
		SolutionModuleID: req.SolutionModuleID,
		AddSolution:      req.AddSolution,
	})
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusCreated, phoneTicketResponse{ID: t.ID, Protocol: t.Protocol})
	case errors.Is(err, ErrSectorNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Setor não encontrado.")
	case errors.Is(err, ErrUnknownContact):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Contato não encontrado.")
	case errors.Is(err, ErrContactNotRegistered):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Cadastre o contato e vincule-o a um órgão antes de registrar.")
	case errors.Is(err, ErrRequestReused):
		httpx.WriteError(w, http.StatusConflict, "Este registro já foi usado por outra pessoa. Tente novamente.")
	default:
		h.closingError(w, r, err)
	}
}
