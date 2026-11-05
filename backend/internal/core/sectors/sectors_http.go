package sectors

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Handler serves the routes of the sectors and their modules.
type Handler struct {
	logger  *slog.Logger
	service *Service
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{logger: logger, service: service}
}

// Routes registers the routes of the sectors, behind the session middleware.
func (h *Handler) Routes(r chi.Router) {
	r.Get("/sectors", h.listSectors)

	// Administração: setores só pelo administrador.
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleAdmin))
		r.Post("/sectors", h.createSector)
		r.Put("/sectors/{sectorID}", h.updateSector)
	})

	// Módulos: supervisor do próprio setor e administrador.
	r.Route("/sectors/{sectorID}/modules", func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin), auth.RequireSector("sectorID"))
		r.Get("/", h.listModules)
		r.Post("/", h.createModule)
		r.Put("/{moduleID}", h.updateModule)
	})

	// Módulos ativos do setor, para o cadastro de contatos e os filtros: todos os papéis do setor.
	r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}/active-modules", h.listActiveModules)
}

type sectorResponse struct {
	ID               int64               `json:"id"`
	Name             string              `json:"name"`
	Email            *string             `json:"email"`
	Phone            *string             `json:"phone"`
	Provider         string              `json:"provider"`
	ConnectionStatus db.ConnectionStatus `json:"connectionStatus"`
	LastConnectedAt  *time.Time          `json:"lastConnectedAt"`
	Active           bool                `json:"active"`
}

func toSectorResponse(s db.Sector) sectorResponse {
	return sectorResponse{
		ID:               s.ID,
		Name:             s.Name,
		Email:            s.Email,
		Phone:            s.Phone,
		Provider:         s.Provider,
		ConnectionStatus: s.ConnectionStatus,
		LastConnectedAt:  s.LastConnectedAt,
		Active:           s.Active,
	}
}

type moduleResponse struct {
	ID       int64  `json:"id"`
	SectorID int64  `json:"sectorId"`
	Name     string `json:"name"`
	Active   bool   `json:"active"`
}

func toModuleResponse(m db.Module) moduleResponse {
	return moduleResponse{ID: m.ID, SectorID: m.SectorID, Name: m.Name, Active: m.Active}
}

// listSectors returns the sectors the user can see: all for admins, only
// their own for agents and supervisors.
func (h *Handler) listSectors(w http.ResponseWriter, r *http.Request) {
	user := auth.CurrentUser(r.Context())
	if user.Role != db.UserRoleAdmin {
		if user.SectorID == nil {
			httpx.WriteJSON(w, http.StatusOK, []sectorResponse{})
			return
		}
		sec, err := h.service.Get(r.Context(), *user.SectorID)
		if err != nil {
			httpx.InternalError(h.logger, w, r, err)
			return
		}
		httpx.WriteJSON(w, http.StatusOK, []sectorResponse{toSectorResponse(sec)})
		return
	}

	sectors, err := h.service.List(r.Context())
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]sectorResponse, len(sectors))
	for i, sec := range sectors {
		out[i] = toSectorResponse(sec)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type sectorRequest struct {
	Name  string `json:"name" validate:"required"`
	Email string `json:"email"`
}

func (h *Handler) createSector(w http.ResponseWriter, r *http.Request) {
	var req sectorRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	sec, err := h.service.Create(r.Context(), auth.CurrentUser(r.Context()).ID, SectorInput(req))
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toSectorResponse(sec))
}

func (h *Handler) updateSector(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req sectorRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	sec, err := h.service.Update(r.Context(), auth.CurrentUser(r.Context()).ID, id, SectorInput(req))
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toSectorResponse(sec))
}

func (h *Handler) listModules(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	modules, err := h.service.ListModules(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]moduleResponse, len(modules))
	for i, m := range modules {
		out[i] = toModuleResponse(m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (h *Handler) listActiveModules(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	modules, err := h.service.ListActiveModules(r.Context(), sectorID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]moduleResponse, len(modules))
	for i, m := range modules {
		out[i] = toModuleResponse(m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type createModuleRequest struct {
	Name string `json:"name" validate:"required"`
}

func (h *Handler) createModule(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req createModuleRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	m, err := h.service.CreateModule(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, req.Name)
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toModuleResponse(m))
}

type updateModuleRequest struct {
	Name   string `json:"name" validate:"required"`
	Active *bool  `json:"active" validate:"required"`
}

func (h *Handler) updateModule(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	moduleID, ok := httpx.URLID(w, r, "moduleID", "Módulo não encontrado.")
	if !ok {
		return
	}
	var req updateModuleRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	m, err := h.service.UpdateModule(r.Context(), auth.CurrentUser(r.Context()).ID, sectorID, moduleID,
		ModuleInput{Name: req.Name, Active: *req.Active})
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toModuleResponse(m))
}

func WriteError(logger *slog.Logger, w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidName):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o nome.")
	case errors.Is(err, ErrNameTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um setor com este nome.")
	case errors.Is(err, ErrInvalidEmail):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe um e-mail válido.")
	case errors.Is(err, ErrEmailTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um setor com este e-mail.")
	case errors.Is(err, ErrNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Setor não encontrado.")
	case errors.Is(err, ErrModuleNameTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um módulo com este nome no setor.")
	case errors.Is(err, ErrModuleNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Módulo não encontrado.")
	default:
		httpx.InternalError(logger, w, r, err)
	}
}
