package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/sector"
)

type sectorResponse struct {
	ID               int64               `json:"id"`
	Name             string              `json:"name"`
	Phone            string              `json:"phone"`
	Provider         string              `json:"provider"`
	ConnectionStatus db.ConnectionStatus `json:"connectionStatus"`
	LastConnectedAt  *time.Time          `json:"lastConnectedAt"`
	Active           bool                `json:"active"`
}

func toSectorResponse(s db.Sector) sectorResponse {
	return sectorResponse{
		ID:               s.ID,
		Name:             s.Name,
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
func (s *server) listSectors(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r.Context())
	if user.Role != db.UserRoleAdmin {
		if user.SectorID == nil {
			writeJSON(w, http.StatusOK, []sectorResponse{})
			return
		}
		sec, err := s.sectors.Get(r.Context(), *user.SectorID)
		if err != nil {
			s.internalError(w, r, err)
			return
		}
		writeJSON(w, http.StatusOK, []sectorResponse{toSectorResponse(sec)})
		return
	}

	sectors, err := s.sectors.List(r.Context())
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	out := make([]sectorResponse, len(sectors))
	for i, sec := range sectors {
		out[i] = toSectorResponse(sec)
	}
	writeJSON(w, http.StatusOK, out)
}

type sectorRequest struct {
	Name  string `json:"name" validate:"required"`
	Phone string `json:"phone" validate:"required"`
}

func (s *server) createSector(w http.ResponseWriter, r *http.Request) {
	var req sectorRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	sec, err := s.sectors.Create(r.Context(), currentUser(r.Context()).ID, sector.SectorInput{Name: req.Name, Phone: req.Phone})
	if err != nil {
		s.sectorError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toSectorResponse(sec))
}

func (s *server) updateSector(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req sectorRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	sec, err := s.sectors.Update(r.Context(), currentUser(r.Context()).ID, id, sector.SectorInput{Name: req.Name, Phone: req.Phone})
	if err != nil {
		s.sectorError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toSectorResponse(sec))
}

func (s *server) listModules(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	modules, err := s.sectors.ListModules(r.Context(), sectorID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	out := make([]moduleResponse, len(modules))
	for i, m := range modules {
		out[i] = toModuleResponse(m)
	}
	writeJSON(w, http.StatusOK, out)
}

type createModuleRequest struct {
	Name string `json:"name" validate:"required"`
}

func (s *server) createModule(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req createModuleRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	m, err := s.sectors.CreateModule(r.Context(), currentUser(r.Context()).ID, sectorID, req.Name)
	if err != nil {
		s.sectorError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toModuleResponse(m))
}

type updateModuleRequest struct {
	Name   string `json:"name" validate:"required"`
	Active *bool  `json:"active" validate:"required"`
}

func (s *server) updateModule(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := urlID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	moduleID, ok := urlID(w, r, "moduleID", "Módulo não encontrado.")
	if !ok {
		return
	}
	var req updateModuleRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	m, err := s.sectors.UpdateModule(r.Context(), currentUser(r.Context()).ID, sectorID, moduleID,
		sector.ModuleInput{Name: req.Name, Active: *req.Active})
	if err != nil {
		s.sectorError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toModuleResponse(m))
}

func (s *server) sectorError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, sector.ErrInvalidName):
		writeError(w, http.StatusUnprocessableEntity, "Informe o nome.")
	case errors.Is(err, sector.ErrInvalidPhone):
		writeError(w, http.StatusUnprocessableEntity, "Informe o número com DDI e DDD, somente dígitos (ex.: 5511999990000).")
	case errors.Is(err, sector.ErrNameTaken):
		writeError(w, http.StatusConflict, "Já existe um setor com este nome.")
	case errors.Is(err, sector.ErrPhoneTaken):
		writeError(w, http.StatusConflict, "Já existe um setor com este número.")
	case errors.Is(err, sector.ErrNotFound):
		writeError(w, http.StatusNotFound, "Setor não encontrado.")
	case errors.Is(err, sector.ErrModuleNameTaken):
		writeError(w, http.StatusConflict, "Já existe um módulo com este nome no setor.")
	case errors.Is(err, sector.ErrModuleNotFound):
		writeError(w, http.StatusNotFound, "Módulo não encontrado.")
	default:
		s.internalError(w, r, err)
	}
}

// urlID parses a numeric URL parameter; on failure it answers 404 with the message.
func urlID(w http.ResponseWriter, r *http.Request, param, notFound string) (int64, bool) {
	id, err := strconv.ParseInt(chi.URLParam(r, param), 10, 64)
	if err != nil {
		writeError(w, http.StatusNotFound, notFound)
		return 0, false
	}
	return id, true
}
