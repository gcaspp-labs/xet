package users

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Handler serves the routes of the users.
type Handler struct {
	logger  *slog.Logger
	service *Service
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{logger: logger, service: service}
}

// Routes registers the routes of the users, behind the session middleware.
func (h *Handler) Routes(r chi.Router) {
	r.With(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin)).
		Put("/users/{userID}/password", h.resetPassword)

	// Administração: usuários só pelo administrador.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleAdmin))
		r.Get("/users", h.listUsers)
		r.Post("/users", h.createUser)
		r.Put("/users/{userID}", h.updateUser)
	})
}

const msgWeakPassword = "A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial."

// adminUserResponse is a user as shown in the administration; the password
// hash never leaves the backend.
type adminUserResponse struct {
	auth.UserResponse
	Active bool `json:"active"`
}

func toAdminUserResponse(u db.User) adminUserResponse {
	return adminUserResponse{
		UserResponse: auth.UserResponse{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID},
		Active:       u.Active,
	}
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := h.service.ListUsers(r.Context())
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]adminUserResponse, len(users))
	for i, u := range users {
		out[i] = toAdminUserResponse(u)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type createUserRequest struct {
	Name     string      `json:"name" validate:"required"`
	Email    string      `json:"email" validate:"required,email"`
	Role     db.UserRole `json:"role" validate:"required,oneof=agent supervisor admin"`
	SectorID *int64      `json:"sectorId"`
	Password string      `json:"password" validate:"required"`
}

func (h *Handler) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	u, err := h.service.CreateUser(r.Context(), auth.CurrentUser(r.Context()), UserInput{
		Name: req.Name, Email: req.Email, Role: req.Role, SectorID: req.SectorID, Active: true,
	}, req.Password)
	if err != nil {
		h.userError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toAdminUserResponse(u))
}

type updateUserRequest struct {
	Name     string      `json:"name" validate:"required"`
	Email    string      `json:"email" validate:"required,email"`
	Role     db.UserRole `json:"role" validate:"required,oneof=agent supervisor admin"`
	SectorID *int64      `json:"sectorId"`
	Active   *bool       `json:"active" validate:"required"`
}

func (h *Handler) updateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "userID", "Usuário não encontrado.")
	if !ok {
		return
	}
	var req updateUserRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	u, err := h.service.UpdateUser(r.Context(), auth.CurrentUser(r.Context()), id, UserInput{
		Name: req.Name, Email: req.Email, Role: req.Role, SectorID: req.SectorID, Active: *req.Active,
	})
	if err != nil {
		h.userError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toAdminUserResponse(u))
}

func (h *Handler) userError(w http.ResponseWriter, r *http.Request, err error) {
	var hasTickets *UserHasTicketsError
	switch {
	case errors.As(err, &hasTickets):
		tickets := fmt.Sprintf("%d chamados", hasTickets.Count)
		if hasTickets.Count == 1 {
			tickets = "1 chamado"
		}
		httpx.WriteError(w, http.StatusConflict, fmt.Sprintf("O usuário tem %s em atendimento. Transfira antes de desativar ou trocar de setor.", tickets))
	case errors.Is(err, ErrWeakPassword):
		httpx.WriteError(w, http.StatusUnprocessableEntity, msgWeakPassword)
	case errors.Is(err, ErrCommonPassword):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Senha muito comum. Escolha outra, mais difícil de adivinhar.")
	case errors.Is(err, ErrPasswordTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "A senha pode ter no máximo 72 caracteres.")
	case errors.Is(err, ErrInvalidUser):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Preencha todos os campos corretamente.")
	case errors.Is(err, ErrSectorRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o setor do usuário. Só o administrador fica sem setor.")
	case errors.Is(err, ErrSectorNotFound):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Setor não encontrado.")
	case errors.Is(err, ErrEmailTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um usuário com este e-mail.")
	case errors.Is(err, ErrSelfLockout):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Você não pode desativar a própria conta nem alterar o próprio papel.")
	case errors.Is(err, ErrUserNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Usuário não encontrado.")
	case errors.Is(err, ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem permissão para esta ação.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}

type resetPasswordRequest struct {
	Password string `json:"password" validate:"required"`
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	targetID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		httpx.WriteError(w, http.StatusNotFound, "Usuário não encontrado.")
		return
	}
	var req resetPasswordRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}

	err = h.service.ResetPassword(r.Context(), auth.CurrentUser(r.Context()), targetID, req.Password)
	switch {
	case err == nil:
		w.WriteHeader(http.StatusNoContent)
	case errors.Is(err, ErrWeakPassword):
		httpx.WriteError(w, http.StatusUnprocessableEntity, msgWeakPassword)
	case errors.Is(err, ErrCommonPassword):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Senha muito comum. Escolha outra, mais difícil de adivinhar.")
	case errors.Is(err, ErrPasswordTooLong):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "A senha pode ter no máximo 72 caracteres.")
	case errors.Is(err, ErrUserNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Usuário não encontrado.")
	case errors.Is(err, ErrForbidden):
		httpx.WriteError(w, http.StatusForbidden, "Você não tem permissão para redefinir a senha deste usuário.")
	default:
		httpx.InternalError(h.logger, w, r, err)
	}
}
