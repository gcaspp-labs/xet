package httpapi

import (
	"net/http"
	"strings"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type spokeWithRequest struct {
	SpokeWith string `json:"spokeWith" validate:"max=200"`
}

func (s *server) setSpokeWith(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req spokeWithRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.SetSpokeWith(r.Context(), auth.CurrentUser(r.Context()), ticketID, req.SpokeWith)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, map[string]any{"id": t.ID, "spokeWith": t.SpokeWith})
}

type noteResponse struct {
	ID        int64     `json:"id"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"createdAt"`
	Author    httpx.Ref `json:"author"`
}

func (s *server) listNotes(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	rows, err := s.tickets.Notes(r.Context(), auth.CurrentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]noteResponse, len(rows))
	for i, n := range rows {
		out[i] = noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: httpx.Ref{ID: n.AuthorID, Name: n.AuthorName}}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type noteRequest struct {
	Body string `json:"body" validate:"required,max=10000"`
}

func (s *server) createNote(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	var req noteRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escreva a nota.")
		return
	}
	user := auth.CurrentUser(r.Context())
	n, err := s.tickets.AddNote(r.Context(), user, ticketID, body)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: httpx.Ref{ID: user.ID, Name: user.Name}})
}
