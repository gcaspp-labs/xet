package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/sector"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
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
	logger    *slog.Logger
	auth      *auth.Service
	sectors   *sector.Service
	directory *directory.Service
	tickets   *ticket.Service
	hub       *realtime.Hub
	opts      Options
}

func NewRouter(logger *slog.Logger, authService *auth.Service, userService *users.Service, sectorService *sector.Service, directoryService *directory.Service, ticketService *ticket.Service, hub *realtime.Hub, opts Options) http.Handler {
	s := &server{
		logger:    logger,
		auth:      authService,
		sectors:   sectorService,
		directory: directoryService,
		tickets:   ticketService,
		hub:       hub,
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
		authHandler := auth.NewHandler(logger, authService, opts.SecureCookie)
		authHandler.Routes(r)

		r.Group(func(r chi.Router) {
			r.Use(authHandler.RequireUser)
			users.NewHandler(logger, userService).Routes(r)
			r.Get("/ws", s.events)

			r.Get("/sectors", s.listSectors)

			// Administração: setores só pelo administrador.
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(db.UserRoleAdmin))
				r.Post("/sectors", s.createSector)
				r.Put("/sectors/{sectorID}", s.updateSector)
			})

			// Módulos: supervisor do próprio setor e administrador.
			r.Route("/sectors/{sectorID}/modules", func(r chi.Router) {
				r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin), auth.RequireSector("sectorID"))
				r.Get("/", s.listModules)
				r.Post("/", s.createModule)
				r.Put("/{moduleID}", s.updateModule)
			})

			// Módulos ativos do setor, para o cadastro de contatos e os filtros: todos os papéis do setor.
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/active-modules", s.listActiveModules)

			// Importar contatos da agenda do número do setor: todos os papéis do setor.
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/saved-contacts", s.listSavedContacts)
			r.With(auth.RequireSector("sectorID")).Post("/sectors/{sectorID}/saved-contacts/import", s.importContacts)

			// Conexão do número: supervisor do próprio setor e administrador.
			r.Route("/sectors/{sectorID}/connection", func(r chi.Router) {
				r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin), auth.RequireSector("sectorID"))
				r.Get("/", s.getConnection)
				r.Post("/", s.connect)
				r.Delete("/", s.disconnect)
				r.Get("/qr.png", s.connectionQR)
			})

			// Órgãos: todos consultam; supervisor e administrador cadastram e editam.
			r.Get("/organizations", s.listOrganizations)
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin))
				r.Post("/organizations", s.createOrganization)
				r.Put("/organizations/{organizationID}", s.updateOrganization)
			})

			// Painel: chamados abertos, carga de cada atendente e realizados hoje, para todos os papéis do setor.
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/tickets", s.listTickets)
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/workload", s.workload)
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/closed-today", s.listClosedToday)
			// Iniciar conversa pelo número do setor, ou ir ao chamado aberto do contato.
			r.With(auth.RequireSector("sectorID")).Post("/sectors/{sectorID}/conversations", s.startConversation)
			r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/contacts/{contactID}/open-ticket", s.openTicket)
			// O serviço confere o setor do chamado e, para responder, o responsável.
			r.Post("/tickets/{ticketID}/assign", s.assignTicket)
			r.Post("/tickets/{ticketID}/transfer", s.transferTicket)
			r.Post("/tickets/{ticketID}/return", s.returnTicket)
			r.Get("/tickets/{ticketID}/assignments", s.listAssignments)
			r.Get("/tickets/{ticketID}/closing-form", s.closingForm)
			r.Post("/tickets/{ticketID}/close", s.closeTicket)
			r.Post("/tickets/{ticketID}/cancel", s.cancelTicket)
			r.Get("/tickets/{ticketID}/transfer-sectors", s.listTransferSectors)
			r.Post("/tickets/{ticketID}/transfer-sector", s.transferSector)
			r.Get("/tickets/{ticketID}/modules", s.listTicketModules)
			r.Post("/tickets/{ticketID}/correct", s.correctTicket)
			r.Get("/tickets/{ticketID}/corrections", s.listCorrections)
			r.Get("/tickets/{ticketID}", s.getTicket)
			r.Get("/tickets/{ticketID}/messages", s.listMessages)
			r.Post("/tickets/{ticketID}/messages", s.sendMessage)
			r.Put("/tickets/{ticketID}/spoke-with", s.setSpokeWith)
			r.Get("/tickets/{ticketID}/notes", s.listNotes)
			r.Post("/tickets/{ticketID}/notes", s.createNote)
			r.Post("/messages/{messageID}/retry", s.retryMessage)
			r.Get("/media/{mediaID}", s.getMedia)
			// Histórico: chamados dos setores do usuário (todos, para o administrador).
			r.Get("/contacts/{contactID}/tickets", s.contactHistory)
			r.Get("/organizations/{organizationID}/tickets", s.organizationHistory)

			// Contatos: o cadastro é único para todos os setores e aberto a todos os papéis.
			r.Get("/contacts", s.listContacts)
			r.Get("/contacts/{contactID}", s.getContact)
			r.Post("/contacts", s.createContact)
			r.Put("/contacts/{contactID}", s.updateContact)
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
