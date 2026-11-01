// Package httpx holds what the routes of every module share: reading the
// request, writing the responses and answering internal errors.
package httpx

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-playground/validator/v10"
)

var validate = validator.New(validator.WithRequiredStructEnabled())

// Ref points to a record by ID and name: a user, a module, an organization or
// a sector.
type Ref struct {
	ID   int64  `json:"id"`
	Name string `json:"name"`
}

// URLID parses a numeric URL parameter; on failure it answers 404 with the message.
func URLID(w http.ResponseWriter, r *http.Request, param, notFound string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, param), 10, 64)
	if err != nil {
		WriteError(w, http.StatusNotFound, notFound)
		return 0, false
	}
	return id, true
}

// DecodeJSON reads and validates the request body; on failure it writes the
// response and returns false.
func DecodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		WriteError(w, http.StatusBadRequest, "Requisição inválida.")
		return false
	}
	if err := validate.Struct(dst); err != nil {
		WriteError(w, http.StatusUnprocessableEntity, "Preencha todos os campos corretamente.")
		return false
	}
	return true
}

func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

// WriteError sends a message meant for the user, in Portuguese.
func WriteError(w http.ResponseWriter, status int, message string) {
	WriteJSON(w, status, map[string]string{"error": message})
}

// InternalError logs the error and answers 500 without showing it to the user.
func InternalError(logger *slog.Logger, w http.ResponseWriter, r *http.Request, err error) {
	logger.Error("internal error",
		"error", err,
		"path", r.URL.Path,
		"request_id", middleware.GetReqID(r.Context()),
	)
	WriteError(w, http.StatusInternalServerError, "Erro interno. Tente novamente.")
}
