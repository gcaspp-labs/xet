package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

type ticketContactResponse struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Phone      *string `json:"phone"`
	Registered bool    `json:"registered"`
}

// urlTicketID parses the ticket ID of the route; on failure it answers 404.
func urlTicketID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	return httpx.URLID(w, r, "ticketID", "Chamado não encontrado.")
}

// ticketError answers the errors shared by the conversation routes.
func (s *server) ticketError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Chamado não encontrado.")
	case errors.Is(err, ticket.ErrMessageNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Mensagem não encontrada.")
	case errors.Is(err, ticket.ErrMediaNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Arquivo não encontrado.")
	case errors.Is(err, ticket.ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	case errors.Is(err, ticket.ErrNotAssignee):
		httpx.WriteError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode responder. Assuma o chamado ou peça a transferência.")
	case errors.Is(err, ticket.ErrClosed):
		httpx.WriteError(w, http.StatusConflict, "Este chamado já foi encerrado.")
	case errors.Is(err, ticket.ErrRequestReused):
		httpx.WriteError(w, http.StatusConflict, "Este envio já foi usado em outra mensagem. Tente novamente.")
	case errors.Is(err, ticket.ErrNotFailed):
		httpx.WriteError(w, http.StatusConflict, "Esta mensagem não está com falha.")
	case errors.Is(err, ticket.ErrInvalidAudio):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Não foi possível ler o áudio gravado. Grave novamente.")
	default:
		httpx.InternalError(s.logger, w, r, err)
	}
}

// closingError answers the errors of the closing form, shared by the
// closing, the transfer between sectors and the correction.
func (s *server) closingError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrIncompleteClosing):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Preencha o assunto, a resolução e ao menos um módulo.")
	case errors.Is(err, ticket.ErrInvalidOrganization):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha um órgão cadastrado.")
	case errors.Is(err, ticket.ErrInvalidModules):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos do setor do chamado.")
	case errors.Is(err, ticket.ErrInvalidPeriod):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "O fim precisa ser depois do início e não pode estar no futuro.")
	default:
		s.ticketError(w, r, err)
	}
}
