package httpapi

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

// refResponse points to a record by ID and name: a user, a module, an
// organization or a sector.
type refResponse struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

type ticketContactResponse struct {
	ID         int64   `json:"id"`
	Name       string  `json:"name"`
	Phone      *string `json:"phone"`
	Registered bool    `json:"registered"`
}

// urlID parses a numeric URL parameter; on failure it answers 404 with the message.
func urlID(w http.ResponseWriter, r *http.Request, param, notFound string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, param), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, notFound)
		return 0, false
	}
	return id, true
}

// urlTicketID parses the ticket ID of the route; on failure it answers 404.
func urlTicketID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	return urlID(w, r, "ticketID", "Chamado não encontrado.")
}

// decodeJSON reads and validates the request body; on failure it writes the
// response and returns false.
func (s *server) decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeError(w, http.StatusBadRequest, "Requisição inválida.")
		return false
	}
	if err := s.validate.Struct(dst); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Preencha todos os campos corretamente.")
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// writeError sends a message meant for the user, in Portuguese.
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

func (s *server) internalError(w http.ResponseWriter, r *http.Request, err error) {
	s.logger.Error("internal error",
		"error", err,
		"path", r.URL.Path,
		"request_id", middleware.GetReqID(r.Context()),
	)
	writeError(w, http.StatusInternalServerError, "Erro interno. Tente novamente.")
}

// ticketError answers the errors shared by the conversation routes.
func (s *server) ticketError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrNotFound):
		writeError(w, http.StatusNotFound, "Chamado não encontrado.")
	case errors.Is(err, ticket.ErrMessageNotFound):
		writeError(w, http.StatusNotFound, "Mensagem não encontrada.")
	case errors.Is(err, ticket.ErrMediaNotFound):
		writeError(w, http.StatusNotFound, "Arquivo não encontrado.")
	case errors.Is(err, ticket.ErrForbidden):
		writeError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	case errors.Is(err, ticket.ErrNotAssignee):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode responder. Assuma o chamado ou peça a transferência.")
	case errors.Is(err, ticket.ErrClosed):
		writeError(w, http.StatusConflict, "Este chamado já foi encerrado.")
	case errors.Is(err, ticket.ErrRequestReused):
		writeError(w, http.StatusConflict, "Este envio já foi usado em outra mensagem. Tente novamente.")
	case errors.Is(err, ticket.ErrNotFailed):
		writeError(w, http.StatusConflict, "Esta mensagem não está com falha.")
	case errors.Is(err, ticket.ErrInvalidAudio):
		writeError(w, http.StatusUnprocessableEntity, "Não foi possível ler o áudio gravado. Grave novamente.")
	default:
		s.internalError(w, r, err)
	}
}

// closingError answers the errors of the closing form, shared by the
// closing, the transfer between sectors and the correction.
func (s *server) closingError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrIncompleteClosing):
		writeError(w, http.StatusUnprocessableEntity, "Preencha o assunto, a resolução e ao menos um módulo.")
	case errors.Is(err, ticket.ErrInvalidOrganization):
		writeError(w, http.StatusUnprocessableEntity, "Escolha um órgão cadastrado.")
	case errors.Is(err, ticket.ErrInvalidModules):
		writeError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos do setor do chamado.")
	case errors.Is(err, ticket.ErrInvalidPeriod):
		writeError(w, http.StatusUnprocessableEntity, "O fim precisa ser depois do início e não pode estar no futuro.")
	default:
		s.ticketError(w, r, err)
	}
}
