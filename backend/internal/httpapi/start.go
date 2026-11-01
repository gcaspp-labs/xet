package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type startConversationRequest struct {
	ContactID       int64  `json:"contactId" validate:"required,gt=0"`
	ClientRequestID string `json:"clientRequestId" validate:"required,uuid"`
	Body            string `json:"body" validate:"required,max=65536"`
}

// startResponse points the panel to the ticket of the conversation: the new
// one, with the first message, or the open ticket the contact already had
// (existing), to which nothing was sent.
type startResponse struct {
	TicketID int64                `json:"ticketId"`
	Existing bool                 `json:"existing"`
	Message  *sentMessageResponse `json:"message"`
}

type openTicketResponse struct {
	TicketID *int64 `json:"ticketId"`
}

// startConversation sends the first message to a contact through the sector
// number, creating a ticket assigned to the user.
func (s *server) startConversation(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req startConversationRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	if strings.TrimSpace(req.Body) == "" {
		writeError(w, http.StatusUnprocessableEntity, "Escreva a mensagem.")
		return
	}
	var requestID pgtype.UUID
	if !parseRequestID(w, req.ClientRequestID, &requestID) {
		return
	}

	started, err := s.tickets.Start(r.Context(), s.opts.Messaging, currentUser(r.Context()), sectorID, req.ContactID, requestID, req.Body)
	switch {
	case errors.Is(err, ticket.ErrSectorNotFound):
		writeError(w, http.StatusNotFound, "Setor não encontrado.")
		return
	case errors.Is(err, ticket.ErrUnknownContact):
		writeError(w, http.StatusUnprocessableEntity, "Contato não encontrado.")
		return
	case errors.Is(err, ticket.ErrContactWithoutPhone):
		writeError(w, http.StatusUnprocessableEntity, "Este contato não tem telefone. Informe o telefone no cadastro para iniciar a conversa.")
		return
	case err != nil:
		s.ticketError(w, r, err)
		return
	}
	out := startResponse{TicketID: started.TicketID, Existing: started.Existing}
	status := http.StatusOK
	if started.Message != nil {
		msg := toSentMessageResponse(*started.Message)
		out.Message = &msg
		status = http.StatusCreated
	}
	writeJSON(w, status, out)
}

// openTicket tells the panel whether the contact already has an open ticket
// in the sector, to direct the user to it before writing the first message.
func (s *server) openTicket(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	contactID, ok := urlID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	id, err := s.tickets.OpenTicketID(r.Context(), sectorID, contactID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, openTicketResponse{TicketID: id})
}
