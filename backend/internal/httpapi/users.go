package httpapi

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// adminUserResponse is a user as shown in the administration; the password
// hash never leaves the backend.
type adminUserResponse struct {
	userResponse
	Active bool `json:"active"`
}

func toAdminUserResponse(u db.User) adminUserResponse {
	return adminUserResponse{
		userResponse: userResponse{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID},
		Active:       u.Active,
	}
}

func (s *server) listUsers(w http.ResponseWriter, r *http.Request) {
	users, err := s.auth.ListUsers(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	out := make([]adminUserResponse, len(users))
	for i, u := range users {
		out[i] = toAdminUserResponse(u)
	}
	writeJSON(w, http.StatusOK, out)
}

type createUserRequest struct {
	Name     string      `json:"name" validate:"required"`
	Email    string      `json:"email" validate:"required,email"`
	Role     db.UserRole `json:"role" validate:"required,oneof=agent supervisor admin"`
	SectorID *int64      `json:"sectorId"`
	Password string      `json:"password" validate:"required"`
}

func (s *server) createUser(w http.ResponseWriter, r *http.Request) {
	var req createUserRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	u, err := s.auth.CreateUser(r.Context(), currentUser(r.Context()), auth.UserInput{
		Name: req.Name, Email: req.Email, Role: req.Role, SectorID: req.SectorID, Active: true,
	}, req.Password)
	if err != nil {
		s.userError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toAdminUserResponse(u))
}

type updateUserRequest struct {
	Name     string      `json:"name" validate:"required"`
	Email    string      `json:"email" validate:"required,email"`
	Role     db.UserRole `json:"role" validate:"required,oneof=agent supervisor admin"`
	SectorID *int64      `json:"sectorId"`
	Active   *bool       `json:"active" validate:"required"`
}

func (s *server) updateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "userID", "Usuário não encontrado.")
	if !ok {
		return
	}
	var req updateUserRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	u, err := s.auth.UpdateUser(r.Context(), currentUser(r.Context()), id, auth.UserInput{
		Name: req.Name, Email: req.Email, Role: req.Role, SectorID: req.SectorID, Active: *req.Active,
	})
	if err != nil {
		s.userError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toAdminUserResponse(u))
}

func (s *server) userError(w http.ResponseWriter, r *http.Request, err error) {
	var hasTickets *auth.UserHasTicketsError
	switch {
	case errors.As(err, &hasTickets):
		tickets := fmt.Sprintf("%d chamados", hasTickets.Count)
		if hasTickets.Count == 1 {
			tickets = "1 chamado"
		}
		writeError(w, http.StatusConflict, fmt.Sprintf("O usuário tem %s em atendimento. Transfira antes de desativar ou trocar de setor.", tickets))
	case errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusUnprocessableEntity, msgWeakPassword)
	case errors.Is(err, auth.ErrPasswordTooLong):
		writeError(w, http.StatusUnprocessableEntity, "A senha pode ter no máximo 72 caracteres.")
	case errors.Is(err, auth.ErrInvalidUser):
		writeError(w, http.StatusUnprocessableEntity, "Preencha todos os campos corretamente.")
	case errors.Is(err, auth.ErrSectorRequired):
		writeError(w, http.StatusUnprocessableEntity, "Informe o setor do usuário. Só o administrador fica sem setor.")
	case errors.Is(err, auth.ErrSectorNotFound):
		writeError(w, http.StatusUnprocessableEntity, "Setor não encontrado.")
	case errors.Is(err, auth.ErrEmailTaken):
		writeError(w, http.StatusConflict, "Já existe um usuário com este e-mail.")
	case errors.Is(err, auth.ErrSelfLockout):
		writeError(w, http.StatusUnprocessableEntity, "Você não pode desativar a própria conta nem alterar o próprio papel.")
	case errors.Is(err, auth.ErrUserNotFound):
		writeError(w, http.StatusNotFound, "Usuário não encontrado.")
	case errors.Is(err, auth.ErrForbidden):
		writeError(w, http.StatusForbidden, "Você não tem permissão para esta ação.")
	default:
		s.internalError(w, r, err)
	}
}
