package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

const sessionCookie = "xet_session"

const msgWeakPassword = "A senha precisa ter no mínimo 8 caracteres, com letra maiúscula, letra minúscula, número e caractere especial."

type userKey struct{}

// currentUser returns the user set by requireUser.
func currentUser(ctx context.Context) auth.User {
	u, _ := ctx.Value(userKey{}).(auth.User)
	return u
}

type userResponse struct {
	ID       int64       `json:"id"`
	Name     string      `json:"name"`
	Email    string      `json:"email"`
	Role     db.UserRole `json:"role"`
	SectorID *int64      `json:"sectorId"`
}

func toUserResponse(u auth.User) userResponse {
	return userResponse{ID: u.ID, Name: u.Name, Email: u.Email, Role: u.Role, SectorID: u.SectorID}
}

func (s *server) setSessionCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   s.opts.SecureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func (s *server) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   s.opts.SecureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func sessionToken(r *http.Request) string {
	c, err := r.Cookie(sessionCookie)
	if err != nil {
		return ""
	}
	return c.Value
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	token, user, expiresAt, err := s.auth.Login(r.Context(), req.Email, req.Password)
	if errors.Is(err, auth.ErrInvalidCredentials) {
		writeError(w, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	s.setSessionCookie(w, token, expiresAt)
	writeJSON(w, http.StatusOK, toUserResponse(user))
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if err := s.auth.Logout(r.Context(), sessionToken(r)); err != nil {
		s.internalError(w, r, err)
		return
	}
	s.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *server) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, toUserResponse(currentUser(r.Context())))
}

type resetPasswordRequest struct {
	Password string `json:"password" validate:"required"`
}

func (s *server) resetPassword(w http.ResponseWriter, r *http.Request) {
	targetID, err := strconv.ParseInt(chi.URLParam(r, "userID"), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, "Usuário não encontrado.")
		return
	}
	var req resetPasswordRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}

	err = s.auth.ResetPassword(r.Context(), currentUser(r.Context()), targetID, req.Password)
	switch {
	case err == nil:
		w.WriteHeader(http.StatusNoContent)
	case errors.Is(err, auth.ErrWeakPassword):
		writeError(w, http.StatusUnprocessableEntity, msgWeakPassword)
	case errors.Is(err, auth.ErrPasswordTooLong):
		writeError(w, http.StatusUnprocessableEntity, "A senha pode ter no máximo 72 caracteres.")
	case errors.Is(err, auth.ErrUserNotFound):
		writeError(w, http.StatusNotFound, "Usuário não encontrado.")
	case errors.Is(err, auth.ErrForbidden):
		writeError(w, http.StatusForbidden, "Você não tem permissão para redefinir a senha deste usuário.")
	default:
		s.internalError(w, r, err)
	}
}

// requireUser rejects requests without a valid session (401) and renews the
// session cookie of valid ones.
func (s *server) requireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := sessionToken(r)
		user, expiresAt, err := s.auth.Authenticate(r.Context(), token)
		if errors.Is(err, auth.ErrInvalidSession) {
			s.clearSessionCookie(w)
			writeError(w, http.StatusUnauthorized, "Entre com seu e-mail e senha para continuar.")
			return
		}
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		s.setSessionCookie(w, token, expiresAt)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	})
}

// requireRole rejects users without one of the roles (403). Use after requireUser.
func requireRole(roles ...db.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !currentUser(r.Context()).HasRole(roles...) {
				writeError(w, http.StatusForbidden, "Você não tem permissão para esta ação.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// requireSector rejects users without access to the sector named by the URL
// parameter (403): agents and supervisors only reach their own sector, admins
// reach all. Use after requireUser.
func requireSector(param string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sectorID, err := strconv.ParseInt(chi.URLParam(r, param), 10, 64)
			if err != nil || !currentUser(r.Context()).CanAccessSector(sectorID) {
				writeError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
