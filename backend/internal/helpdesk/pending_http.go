package helpdesk

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type pendingTicketResponse struct {
	ID               int64                 `json:"id"`
	Protocol         string                `json:"protocol"`
	Status           db.TicketStatus       `json:"status"`
	Contact          ticketContactResponse `json:"contact"`
	OrganizationName *string               `json:"organizationName"`
	MunicipalityName *string               `json:"municipalityName"`
	Reason           *string               `json:"reason"`
	PendingBy        *httpx.Ref            `json:"pendingBy"`
	PendingAt        *time.Time            `json:"pendingAt"`
	Sector           httpx.Ref             `json:"sector"`
}

// listPendingTickets returns the pending tickets of the sector, oldest first.
func (h *Handler) listPendingTickets(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	rows, err := h.service.ListPending(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]pendingTicketResponse, len(rows))
	for i, t := range rows {
		// O órgão é o do chamado; enquanto ele não tem, o do contato — um
		// contato cadastrado com o chamado pendente já aparece na lista.
		organization, municipality := t.OrganizationName, t.MunicipalityName
		if organization == nil {
			organization, municipality = t.ContactOrganizationName, t.ContactMunicipalityName
		}
		out[i] = pendingTicketResponse{
			ID:               t.ID,
			Protocol:         t.Protocol,
			Status:           t.Status,
			Contact:          ticketContactResponse{ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered},
			OrganizationName: organization,
			MunicipalityName: municipality,
			Reason:           t.PendingReason,
			PendingAt:        t.PendingAt,
			Sector:           httpx.Ref{ID: t.SectorID, Name: t.SectorName},
		}
		if t.PendingByID != nil && t.PendingByName != nil {
			out[i].PendingBy = &httpx.Ref{ID: *t.PendingByID, Name: *t.PendingByName}
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// resumeTicket brings a pending ticket back to attendance with the user.
func (h *Handler) resumeTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := h.service.Resume(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	var open *OpenTicketError
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.As(err, &open):
		httpx.WriteError(w, http.StatusConflict, open.Message())
	case errors.Is(err, ErrNotPending):
		httpx.WriteError(w, http.StatusConflict, "Este chamado não está pendente.")
	case errors.Is(err, ErrAlreadyAssigned):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já foi assumido por outro atendente.")
	case errors.Is(err, ErrClosed):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já foi encerrado.")
	case errors.Is(err, ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Chamado não encontrado.")
	case errors.Is(err, ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}

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
