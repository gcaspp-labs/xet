package httpapi

import (
	"net/http"
	"strconv"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
)

type contactModuleResponse struct {
	ID       int64  `json:"id"`
	SectorID int64  `json:"sectorId"`
	Name     string `json:"name"`
}

type contactResponse struct {
	ID           int64                   `json:"id"`
	Name         string                  `json:"name"`
	Phone        *string                 `json:"phone"`
	Registered   bool                    `json:"registered"`
	Organization *organizationResponse   `json:"organization"`
	Sectors      []httpx.Ref             `json:"sectors"`
	Modules      []contactModuleResponse `json:"modules"`
}

func toContactResponse(c directory.Contact) contactResponse {
	out := contactResponse{
		ID: c.ID, Name: c.Name, Phone: c.Phone, Registered: c.Registered,
		Sectors: make([]httpx.Ref, len(c.Sectors)),
		Modules: make([]contactModuleResponse, len(c.Modules)),
	}
	if c.OrganizationID != nil && c.OrganizationName != nil {
		out.Organization = &organizationResponse{ID: *c.OrganizationID, Name: *c.OrganizationName, CNPJ: c.OrganizationCNPJ}
	}
	for i, sec := range c.Sectors {
		out.Sectors[i] = httpx.Ref{ID: sec.ID, Name: sec.Name}
	}
	for i, m := range c.Modules {
		out.Modules[i] = contactModuleResponse{ID: m.ID, SectorID: m.SectorID, Name: m.Name}
	}
	return out
}

// filterID reads an optional ID of the query string; zero means no filter.
func filterID(r *http.Request, name string) (int64, bool) {
	raw := r.URL.Query().Get(name)
	if raw == "" {
		return 0, true
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	return id, err == nil && id > 0
}

// listContacts searches contacts by contact or organization name, phone or
// CNPJ (?q=), in a sector (?sectorId=) and module (?moduleId=).
func (s *server) listContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, okSector := filterID(r, "sectorId")
	moduleID, okModule := filterID(r, "moduleId")
	if !okSector || !okModule {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Filtro inválido.")
		return
	}
	contacts, err := s.directory.SearchContacts(r.Context(),
		directory.ContactFilter{Query: r.URL.Query().Get("q"), SectorID: sectorID, ModuleID: moduleID})
	if err != nil {
		httpx.InternalError(s.logger, w, r, err)
		return
	}
	out := make([]contactResponse, len(contacts))
	for i, c := range contacts {
		out[i] = toContactResponse(c)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

func (s *server) getContact(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	c, err := s.directory.GetContact(r.Context(), id)
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toContactResponse(c))
}

type contactRequest struct {
	Name           string  `json:"name" validate:"required"`
	Phone          string  `json:"phone" validate:"required"`
	OrganizationID int64   `json:"organizationId" validate:"required"`
	SectorIDs      []int64 `json:"sectorIds" validate:"max=100"`
	ModuleIDs      []int64 `json:"moduleIds" validate:"max=500"`
}

func (req contactRequest) input() directory.ContactInput {
	return directory.ContactInput{
		Name: req.Name, Phone: req.Phone, OrganizationID: req.OrganizationID,
		SectorIDs: req.SectorIDs, ModuleIDs: req.ModuleIDs,
	}
}

func (s *server) createContact(w http.ResponseWriter, r *http.Request) {
	var req contactRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	c, err := s.directory.CreateContact(r.Context(), auth.CurrentUser(r.Context()), req.input())
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toContactResponse(c))
}

func (s *server) updateContact(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	var req contactRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	// Pelo serviço de chamados: o cadastro completa o órgão dos chamados abertos do contato.
	c, err := s.tickets.RegisterContact(r.Context(), auth.CurrentUser(r.Context()), id, req.input())
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toContactResponse(c))
}
