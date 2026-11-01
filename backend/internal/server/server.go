// Package server assembles the router with the routes of each module.
package server

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/sectors"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// Services holds the service of each module, created by the caller because
// the messaging provider needs the service desk before the routes exist.
type Services struct {
	Auth      *auth.Service
	Users     *users.Service
	Sectors   *sectors.Service
	Directory *directory.Service
	Helpdesk  *helpdesk.Service
	Hub       *realtime.Hub
}

type Options struct {
	// SecureCookie sets the Secure flag on the session cookie. Disabled only
	// in development over plain HTTP.
	SecureCookie bool
	// Messaging is the provider of the sector numbers.
	Messaging messaging.Provider
	// SessionCheckInterval is how often an open WebSocket connection checks
	// its session; one minute when zero.
	SessionCheckInterval time.Duration
	// TestRoutes, when set, is mounted at /api/test. Only the fake messaging
	// provider sets it, for the end-to-end tests.
	TestRoutes http.Handler
}

func NewRouter(logger *slog.Logger, s Services, opts Options) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(requestLogger(logger))
	r.Use(middleware.Recoverer)

	r.Get("/health", health)

	authHandler := auth.NewHandler(logger, s.Auth, opts.SecureCookie)
	r.Route("/api", func(r chi.Router) {
		if opts.TestRoutes != nil {
			r.Mount("/test", opts.TestRoutes)
		}
		authHandler.Routes(r)

		r.Group(func(r chi.Router) {
			r.Use(authHandler.RequireUser)
			realtime.NewHandler(logger, s.Auth, s.Hub, opts.SessionCheckInterval).Routes(r)
			users.NewHandler(logger, s.Users).Routes(r)
			sectors.NewHandler(logger, s.Sectors).Routes(r)
			directory.NewHandler(logger, s.Directory).Routes(r)
			helpdesk.NewHandler(logger, s.Helpdesk, s.Sectors, opts.Messaging).Routes(r)
		})
	})

	return r
}

func health(w http.ResponseWriter, _ *http.Request) {
	httpx.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func requestLogger(logger *slog.Logger) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)
			start := time.Now()
			next.ServeHTTP(ww, r)
			logger.Info("http request",
				"method", r.Method,
				"path", r.URL.Path,
				"status", ww.Status(),
				"duration_ms", time.Since(start).Milliseconds(),
				"request_id", middleware.GetReqID(r.Context()),
			)
		})
	}
}
