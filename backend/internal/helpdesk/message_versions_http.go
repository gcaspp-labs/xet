package helpdesk

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// messageChangeResponse is a version of a message (kind "original" or "edit",
// with its content) or its deletion (kind "deletion", with the scope).
type messageChangeResponse struct {
	ID     int64                    `json:"id"`
	Kind   db.MessageChangeKind     `json:"kind"`
	Origin db.MessageOrigin         `json:"origin"`
	Author *httpx.Ref               `json:"author"`
	Body   *string                  `json:"body"`
	Scope  *db.MessageDeletionScope `json:"scope"`
	At     time.Time                `json:"at"`
}

// listMessageChanges answers the history of versions and deletion of one
// message, read only.
func (h *Handler) listMessageChanges(w http.ResponseWriter, r *http.Request) {
	messageID, ok := httpx.URLID(w, r, "messageID", "Mensagem não encontrada.")
	if !ok {
		return
	}
	rows, err := h.service.MessageChanges(r.Context(), auth.CurrentUser(r.Context()), messageID)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	out := make([]messageChangeResponse, len(rows))
	for i, c := range rows {
		out[i] = messageChangeResponse{ID: c.ID, Kind: c.Kind, Origin: c.Origin, Body: c.Body, At: c.OccurredAt}
		if c.AuthorID != nil && c.AuthorName != nil {
			out[i].Author = &httpx.Ref{ID: *c.AuthorID, Name: *c.AuthorName}
		}
		if c.DeletionScope.Valid {
			out[i].Scope = &c.DeletionScope.MessageDeletionScope
		}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}
