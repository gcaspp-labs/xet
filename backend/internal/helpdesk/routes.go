package helpdesk

import (
	"log/slog"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/sectors"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// Handler serves the routes of the service desk.
type Handler struct {
	logger   *slog.Logger
	service  *Service
	sectors  *sectors.Service
	provider messaging.Provider
}

func NewHandler(logger *slog.Logger, service *Service, sectorService *sectors.Service, provider messaging.Provider) *Handler {
	return &Handler{logger: logger, service: service, sectors: sectorService, provider: provider}
}

// Routes registers the routes of the service desk, behind the session middleware.
func (h *Handler) Routes(r chi.Router) {
	// Importar contatos da agenda do número do setor: todos os papéis do setor.
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/saved-contacts", h.listSavedContacts)
	r.With(auth.RequireSector("sectorID")).Post("/sectors/{sectorID}/saved-contacts/import", h.importContacts)

	// Conexão do número: supervisor do próprio setor e administrador.
	r.Route("/sectors/{sectorID}/connection", func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin), auth.RequireSector("sectorID"))
		r.Get("/", h.getConnection)
		r.Post("/", h.connect)
		r.Delete("/", h.disconnect)
		r.Get("/qr.png", h.connectionQR)
	})

	// Assuntos: supervisor do próprio setor e administrador. O atendente lê a lista pelo formulário de encerramento.
	r.Route("/sectors/{sectorID}/subjects", func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin), auth.RequireSector("sectorID"))
		r.Get("/", h.listSubjects)
		r.Post("/", h.createSubject)
		r.Put("/{subjectID}", h.updateSubject)
		r.Delete("/{subjectID}", h.deleteSubject)
	})

	// Painel: chamados abertos, carga de cada atendente e realizados hoje, para todos os papéis do setor.
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/tickets", h.listTickets)
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/workload", h.workload)
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/closed-today", h.listClosedToday)
	// Dashboard: supervisor do próprio setor e administrador. O serviço confere o setor pedido nos filtros.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin))
		r.Get("/dashboard", h.dashboard)
		r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/dashboard/assignees", h.listDashboardAssignees)
	})
	// Iniciar conversa pelo número do setor, ou ir ao chamado aberto do contato.
	r.With(auth.RequireSector("sectorID")).Post("/sectors/{sectorID}/conversations", h.startConversation)
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/contacts/{contactID}/open-ticket", h.openTicket)
	// O serviço confere o setor do chamado e, para responder, o responsável.
	r.Post("/tickets/{ticketID}/assign", h.assignTicket)
	r.Post("/tickets/{ticketID}/transfer", h.transferTicket)
	r.Post("/tickets/{ticketID}/return", h.returnTicket)
	r.Get("/tickets/{ticketID}/assignments", h.listAssignments)
	r.Get("/tickets/{ticketID}/closing-form", h.closingForm)
	r.Post("/tickets/{ticketID}/close", h.closeTicket)
	r.Post("/tickets/{ticketID}/cancel", h.cancelTicket)
	r.Get("/tickets/{ticketID}/transfer-sectors", h.listTransferSectors)
	r.Post("/tickets/{ticketID}/transfer-sector", h.transferSector)
	r.Get("/tickets/{ticketID}/modules", h.listTicketModules)
	r.Post("/tickets/{ticketID}/correct", h.correctTicket)
	r.Get("/tickets/{ticketID}/corrections", h.listCorrections)
	r.Get("/tickets/{ticketID}", h.getTicket)
	r.Get("/tickets/{ticketID}/messages", h.listMessages)
	r.Post("/tickets/{ticketID}/messages", h.sendMessage)
	r.Put("/tickets/{ticketID}/spoke-with", h.setSpokeWith)
	r.Get("/tickets/{ticketID}/notes", h.listNotes)
	r.Post("/tickets/{ticketID}/notes", h.createNote)
	r.Post("/messages/{messageID}/retry", h.retryMessage)
	r.Get("/media/{mediaID}", h.getMedia)
	// Histórico: chamados dos setores do usuário (todos, para o administrador).
	r.Get("/contacts/{contactID}/tickets", h.contactHistory)
	r.Get("/organizations/{organizationID}/tickets", h.organizationHistory)
	// Edição de contato: pelo serviço de chamados, porque o cadastro completa o órgão dos chamados abertos.
	r.Put("/contacts/{contactID}", h.updateContact)
	r.Put("/contacts/{contactID}/name", h.setContactName)
}
