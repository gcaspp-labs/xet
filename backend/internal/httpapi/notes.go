package httpapi

import (
	"net/http"
	"strings"
	"time"
)

type spokeWithRequest struct {
	SpokeWith string `json:"spokeWith" validate:"max=200"`
}

func (s *server) setSpokeWith(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req spokeWithRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.SetSpokeWith(r.Context(), currentUser(r.Context()), ticketID, req.SpokeWith)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": t.ID, "spokeWith": t.SpokeWith})
}

type noteResponse struct {
	ID        int64              `json:"id"`
	Body      string             `json:"body"`
	CreatedAt time.Time          `json:"createdAt"`
	Author    ticketUserResponse `json:"author"`
}

func (s *server) listNotes(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.Notes(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]noteResponse, len(rows))
	for i, n := range rows {
		out[i] = noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: ticketUserResponse{ID: n.AuthorID, Name: n.AuthorName}}
	}
	writeJSON(w, http.StatusOK, out)
}

type noteRequest struct {
	Body string `json:"body" validate:"required,max=10000"`
}

func (s *server) createNote(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req noteRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		writeError(w, http.StatusUnprocessableEntity, "Escreva a nota.")
		return
	}
	user := currentUser(r.Context())
	n, err := s.tickets.AddNote(r.Context(), user, ticketID, body)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: ticketUserResponse{ID: user.ID, Name: user.Name}})
}
