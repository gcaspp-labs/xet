package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-playground/validator/v10"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/sector"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

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

type server struct {
	logger    *slog.Logger
	auth      *auth.Service
	sectors   *sector.Service
	directory *directory.Service
	tickets   *ticket.Service
	hub       *realtime.Hub
	validate  *validator.Validate
	opts      Options
}

func NewRouter(logger *slog.Logger, authService *auth.Service, sectorService *sector.Service, directoryService *directory.Service, ticketService *ticket.Service, hub *realtime.Hub, opts Options) http.Handler {
	s := &server{
		logger:    logger,
		auth:      authService,
		sectors:   sectorService,
		directory: directoryService,
		tickets:   ticketService,
		hub:       hub,
		validate:  validator.New(validator.WithRequiredStructEnabled()),
		opts:      opts,
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
		r.Post("/auth/login", s.login)
		r.Post("/auth/logout", s.logout)

		r.Group(func(r chi.Router) {
			r.Use(s.requireUser)
			r.Get("/auth/me", s.me)
			r.Get("/ws", s.events)
			r.With(requireRole(db.UserRoleSupervisor, db.UserRoleAdmin)).
				Put("/users/{userID}/password", s.resetPassword)

			r.Get("/sectors", s.listSectors)

			// Administração: setores e usuários só pelo administrador.
			r.Group(func(r chi.Router) {
				r.Use(requireRole(db.UserRoleAdmin))
				r.Post("/sectors", s.createSector)
				r.Put("/sectors/{sectorID}", s.updateSector)
				r.Get("/users", s.listUsers)
				r.Post("/users", s.createUser)
				r.Put("/users/{userID}", s.updateUser)
			})

			// Módulos: supervisor do próprio setor e administrador.
			r.Route("/sectors/{sectorID}/modules", func(r chi.Router) {
				r.Use(requireRole(db.UserRoleSupervisor, db.UserRoleAdmin), requireSector("sectorID"))
				r.Get("/", s.listModules)
				r.Post("/", s.createModule)
				r.Put("/{moduleID}", s.updateModule)
			})

			// Conexão do número: supervisor do próprio setor e administrador.
			r.Route("/sectors/{sectorID}/connection", func(r chi.Router) {
				r.Use(requireRole(db.UserRoleSupervisor, db.UserRoleAdmin), requireSector("sectorID"))
				r.Get("/", s.getConnection)
				r.Post("/", s.connect)
				r.Get("/qr.png", s.connectionQR)
			})

			// Órgãos: todos consultam; supervisor e administrador cadastram e editam.
			r.Get("/organizations", s.listOrganizations)
			r.Group(func(r chi.Router) {
				r.Use(requireRole(db.UserRoleSupervisor, db.UserRoleAdmin))
				r.Post("/organizations", s.createOrganization)
				r.Put("/organizations/{organizationID}", s.updateOrganization)
			})

			// Painel: chamados abertos e carga de cada atendente, para todos os papéis do setor.
			r.With(requireSector("sectorID")).Get("/sectors/{sectorID}/tickets", s.listTickets)
			r.With(requireSector("sectorID")).Get("/sectors/{sectorID}/workload", s.workload)
			// O serviço confere o setor do chamado.
			r.Post("/tickets/{ticketID}/assign", s.assignTicket)

			// Contatos: o cadastro é único para todos os setores e aberto a todos os papéis.
			r.Get("/contacts", s.listContacts)
			r.Post("/contacts", s.createContact)
			r.Put("/contacts/{contactID}", s.updateContact)
		})
	})

	return r
}

func health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
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
