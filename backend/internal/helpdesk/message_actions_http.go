package helpdesk

import (
	"net/http"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

type editMessageRequest struct {
	ClientRequestID string `json:"clientRequestId" validate:"required,uuid"`
	Body            string `json:"body" validate:"max=65536"`
}

type deleteMessageRequest struct {
	ClientRequestID string `json:"clientRequestId" validate:"required,uuid"`
	// Scope is "everyone" (in WhatsApp too) or "local" (hidden in the
	// system for the whole sector, without going to WhatsApp).
	Scope db.MessageDeletionScope `json:"scope" validate:"required,oneof=everyone local"`
}

// changedMessageResponse is the message right after an edit or deletion; the
// panel reloads the conversation for the rest.
type changedMessageResponse struct {
	ID       int64             `json:"id"`
	TicketID int64             `json:"ticketId"`
	Body     *string           `json:"body"`
	EditedAt *time.Time        `json:"editedAt"`
	Deletion *deletionResponse `json:"deletion"`
}

func toChangedMessageResponse(m db.Message) changedMessageResponse {
	out := changedMessageResponse{ID: m.ID, TicketID: m.TicketID, Body: m.Body, EditedAt: m.EditedAt}
	if m.DeletedAt != nil && m.DeletionScope.Valid && m.DeletionOrigin.Valid {
		out.Deletion = &deletionResponse{At: *m.DeletedAt, Scope: m.DeletionScope.MessageDeletionScope, Origin: m.DeletionOrigin.MessageOrigin}
	}
	return out
}

// editMessage replaces the text or caption of a message sent through the
// system, keeping the nickname recorded in the send.
func (h *Handler) editMessage(w http.ResponseWriter, r *http.Request) {
	messageID, ok := httpx.URLID(w, r, "messageID", "Mensagem não encontrada.")
	if !ok {
		return
	}
	var req editMessageRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	change := MessageChange{Kind: db.MessageActionKindEdit, Body: req.Body}
	if !parseRequestID(w, req.ClientRequestID, &change.ClientRequestID) {
		return
	}
	h.changeMessage(w, r, messageID, change)
}

// deleteMessage deletes a message sent through the system for everyone or
// only in the system; the content is kept for the history.
func (h *Handler) deleteMessage(w http.ResponseWriter, r *http.Request) {
	messageID, ok := httpx.URLID(w, r, "messageID", "Mensagem não encontrada.")
	if !ok {
		return
	}
	var req deleteMessageRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	change := MessageChange{Kind: db.MessageActionKindDeleteEveryone}
	if req.Scope == db.MessageDeletionScopeLocal {
		change.Kind = db.MessageActionKindDeleteLocal
	}
	if !parseRequestID(w, req.ClientRequestID, &change.ClientRequestID) {
		return
	}
	h.changeMessage(w, r, messageID, change)
}

func (h *Handler) changeMessage(w http.ResponseWriter, r *http.Request, messageID int64, change MessageChange) {
	msg, err := h.service.ChangeMessage(r.Context(), h.provider, auth.CurrentUser(r.Context()), messageID, change)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toChangedMessageResponse(msg))
}
