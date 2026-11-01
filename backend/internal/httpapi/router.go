package httpapi

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

type Options struct {
	// SecureCookie sets the Secure flag on the session cookie.
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

type server struct {
	logger *slog.Logger
	auth   *auth.Service
	hub    *realtime.Hub
	opts   Options
}

func NewRouter(logger *slog.Logger, authService *auth.Service, userService *users.Service, sectorService *sectors.Service, directoryService *directory.Service, ticketService *helpdesk.Service, hub *realtime.Hub, opts Options) http.Handler {
	s := &server{
		logger: logger,
		auth:   authService,
		hub:    hub,
		opts:   opts,
	}

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(requestLogger(logger))
	r.Use(middleware.Recoverer)

	r.Get("/health", health)

	r.Route("/api", func(r chi.Router) {
		if opts.TestRoutes != nil {
			r.Mount("/test", opts.TestRoutes)
		}
		authHandler := auth.NewHandler(logger, authService, opts.SecureCookie)
		authHandler.Routes(r)

		r.Group(func(r chi.Router) {
			r.Use(authHandler.RequireUser)
			users.NewHandler(logger, userService).Routes(r)
			r.Get("/ws", s.events)

			sectors.NewHandler(logger, sectorService).Routes(r)
			directory.NewHandler(logger, directoryService).Routes(r)

			helpdesk.NewHandler(logger, ticketService, sectorService, opts.Messaging).Routes(r)
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
