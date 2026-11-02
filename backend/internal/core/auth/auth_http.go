package auth

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"net/netip"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Handler serves the login routes and the session middleware.
type Handler struct {
	logger       *slog.Logger
	service      *Service
	secureCookie bool
	trustProxy   bool
}

// NewHandler creates the handler. secureCookie sets the Secure flag on the
// session cookie; it is disabled only in development over plain HTTP. trustProxy
// takes the client IP from X-Forwarded-For; it is enabled only when the backend
// is reachable just through the reverse proxy, or the header could be forged.
func NewHandler(logger *slog.Logger, service *Service, secureCookie, trustProxy bool) *Handler {
	return &Handler{logger: logger, service: service, secureCookie: secureCookie, trustProxy: trustProxy}
}

// Routes registers the login routes, the only ones open without a session.
func (h *Handler) Routes(r chi.Router) {
	r.Post("/auth/login", h.login)
	r.Post("/auth/logout", h.logout)
	r.With(h.RequireUser).Get("/auth/me", h.me)
}

const SessionCookie = "xet_session"

type userKey struct{}

// CurrentUser returns the user set by RequireUser.

func CurrentUser(ctx context.Context) User {
	u, _ := ctx.Value(userKey{}).(User)
	return u
}

// UserResponse is a user as the API shows it.
type UserResponse struct {
	ID       int64       `json:"id"`
	Name     string      `json:"name"`
	Email    string      `json:"email"`
	Role     db.UserRole `json:"role"`
	SectorID *int64      `json:"sectorId"`
}

func toUserResponse(u User) UserResponse {
	return UserResponse(u)
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, token string, expiresAt time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    token,
		Path:     "/",
		Expires:  expiresAt,
		MaxAge:   int(time.Until(expiresAt).Seconds()),
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func (h *Handler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     SessionCookie,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   h.secureCookie,
		SameSite: http.SameSiteLaxMode,
	})
}

func SessionToken(r *http.Request) string {
	c, err := r.Cookie(SessionCookie)
	if err != nil {
		return ""
	}
	return c.Value
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	token, user, expiresAt, err := h.service.Login(r.Context(), req.Email, req.Password, h.clientIP(r))
	if errors.Is(err, ErrInvalidCredentials) {
		httpx.WriteError(w, http.StatusUnauthorized, "E-mail ou senha incorretos.")
		return
	}
	if errors.Is(err, ErrLoginLocked) {
		httpx.WriteError(w, http.StatusTooManyRequests, "Login bloqueado por excesso de tentativas. Aguarde até 15 minutos e tente novamente.")
		return
	}
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	h.setSessionCookie(w, token, expiresAt)
	httpx.WriteJSON(w, http.StatusOK, toUserResponse(user))
}

// clientIP is the address of the connection or, behind the trusted proxy, the
// last value of X-Forwarded-For, the only one the proxy itself writes.
func (h *Handler) clientIP(r *http.Request) string {
	if h.trustProxy {
		forwarded := strings.Join(r.Header.Values("X-Forwarded-For"), ",")
		last := forwarded[strings.LastIndex(forwarded, ",")+1:]
		if addr, err := netip.ParseAddr(strings.TrimSpace(last)); err == nil {
			return addr.Unmap().String()
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	if err := h.service.Logout(r.Context(), SessionToken(r)); err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, toUserResponse(CurrentUser(r.Context())))
}

// RequireUser rejects requests without a valid session (401) and renews the
// session cookie of valid ones.
func (h *Handler) RequireUser(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := SessionToken(r)
		user, expiresAt, err := h.service.Authenticate(r.Context(), token)
		if errors.Is(err, ErrInvalidSession) {
			h.clearSessionCookie(w)
			httpx.WriteError(w, http.StatusUnauthorized, "Entre com seu e-mail e senha para continuar.")
			return
		}
		if err != nil {
			httpx.InternalError(h.logger, w, r, err)
			return
		}
		h.setSessionCookie(w, token, expiresAt)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userKey{}, user)))
	})
}

// RequireRole rejects users without one of the roles (403). Use after RequireUser.
func RequireRole(roles ...db.UserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !CurrentUser(r.Context()).HasRole(roles...) {
				httpx.WriteError(w, http.StatusForbidden, "Você não tem permissão para esta ação.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireSector rejects users without access to the sector named by the URL
// parameter (403): agents and supervisors only reach their own sector, admins
// reach all. Use after RequireUser.
func RequireSector(param string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			sectorID, err := strconv.ParseInt(chi.URLParam(r, param), 10, 64)
			if err != nil || !CurrentUser(r.Context()).CanAccessSector(sectorID) {
				httpx.WriteError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
