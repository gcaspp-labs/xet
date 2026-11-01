package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type lastMessageResponse struct {
	Type   db.MessageType   `json:"type"`
	Body   *string          `json:"body"`
	Origin db.MessageOrigin `json:"origin"`
	SentAt time.Time        `json:"sentAt"`
}

type ticketSummaryResponse struct {
	ID               int64                 `json:"id"`
	Protocol         string                `json:"protocol"`
	Status           db.TicketStatus       `json:"status"`
	ArrivedAt        time.Time             `json:"arrivedAt"`
	AssignedAt       *time.Time            `json:"assignedAt"`
	Contact          ticketContactResponse `json:"contact"`
	OrganizationName *string               `json:"organizationName"`
	Assignee         *httpx.Ref            `json:"assignee"`
	LastMessage      *lastMessageResponse  `json:"lastMessage"`
}

func toTicketSummaryResponse(t ticket.Summary) ticketSummaryResponse {
	out := ticketSummaryResponse{
		ID:         t.ID,
		Protocol:   t.Protocol,
		Status:     t.Status,
		ArrivedAt:  t.ArrivedAt,
		AssignedAt: t.AssignedAt,
		Contact: ticketContactResponse{
			ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered,
		},
		OrganizationName: t.OrganizationName,
	}
	if t.AssigneeID != nil && t.AssigneeName != nil {
		out.Assignee = &httpx.Ref{ID: *t.AssigneeID, Name: *t.AssigneeName}
	}
	if m := t.LastMessage; m != nil {
		out.LastMessage = &lastMessageResponse{Type: m.Type, Body: m.Body, Origin: m.Origin, SentAt: m.SentAt}
	}
	return out
}

type workloadResponse struct {
	ID            int64       `json:"id"`
	Name          string      `json:"name"`
	Role          db.UserRole `json:"role"`
	Active        bool        `json:"active"`
	ActiveTickets int32       `json:"activeTickets"`
}

type assignResponse struct {
	ID         int64           `json:"id"`
	Status     db.TicketStatus `json:"status"`
	AssigneeID *int64          `json:"assigneeId"`
	AssignedAt *time.Time      `json:"assignedAt"`
}

// listTickets returns the open tickets of the sector: the queue and the
// tickets in progress with their assignee.
func (s *server) listTickets(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	tickets, err := s.tickets.ListOpen(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(s.logger, w, r, err)
		return
	}
	out := make([]ticketSummaryResponse, len(tickets))
	for i, t := range tickets {
		out[i] = toTicketSummaryResponse(t)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// workload returns how many tickets in progress each user of the sector has.
func (s *server) workload(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.Workload(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(s.logger, w, r, err)
		return
	}
	out := make([]workloadResponse, len(rows))
	for i, u := range rows {
		out[i] = workloadResponse{ID: u.ID, Name: u.Name, Role: u.Role, Active: u.Active, ActiveTickets: u.ActiveTickets}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *server) assignTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	t, err := s.tickets.Assign(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	switch {
	case err == nil:
		httpx.WriteJSON(w, http.StatusOK, assignResponse{ID: t.ID, Status: t.Status, AssigneeID: t.AssigneeID, AssignedAt: t.AssignedAt})
	case errors.Is(err, ticket.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Chamado não encontrado.")
	case errors.Is(err, ticket.ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	case errors.Is(err, ticket.ErrAlreadyAssigned):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já foi assumido por outro atendente.")
	case errors.Is(err, ticket.ErrClosed):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já foi encerrado.")
	default:
		httpx.InternalError(s.logger, w, r, err)
	}
}
