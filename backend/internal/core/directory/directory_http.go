package directory

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/core/paging"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// Handler serves the routes of the organizations and contacts.
type Handler struct {
	logger  *slog.Logger
	service *Service
}

func NewHandler(logger *slog.Logger, service *Service) *Handler {
	return &Handler{logger: logger, service: service}
}

// Routes registers the routes of the directory, behind the session middleware.
func (h *Handler) Routes(r chi.Router) {
	// Órgãos: todos consultam; supervisor e administrador cadastram e editam.
	// A lista completa de municípios serve só ao formulário de órgão; os que têm
	// órgão servem ao filtro de contatos, aberto a todos os papéis.
	r.Get("/organizations", h.listOrganizations)
	r.Get("/organizations/municipalities", h.listOrganizationMunicipalities)
	r.Group(func(r chi.Router) {
		r.Use(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin))
		r.Get("/municipalities", h.listMunicipalities)
		r.Get("/cnpj/{cnpj}", h.lookupCNPJ)
		r.Post("/organizations", h.createOrganization)
		r.Put("/organizations/{organizationID}", h.updateOrganization)
	})

	// Contatos: o cadastro é único para todos os setores e aberto a todos os papéis.
	// A edição fica em helpdesk, porque completa o órgão dos chamados abertos.
	r.Get("/contacts", h.listContacts)
	r.Get("/contacts/{contactID}", h.getContact)
	r.Post("/contacts", h.createContact)
}

type organizationResponse struct {
	ID           int64     `json:"id"`
	Name         string    `json:"name"`
	CNPJ         *string   `json:"cnpj"`
	Municipality httpx.Ref `json:"municipality"`
}

func toOrganizationResponse(o Organization) organizationResponse {
	return organizationResponse{
		ID: o.Organization.ID, Name: o.Organization.Name, CNPJ: o.Organization.Cnpj,
		Municipality: httpx.Ref{ID: o.Organization.MunicipalityID, Name: o.MunicipalityName},
	}
}

type municipalityResponse struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	AudespCode string `json:"audespCode"`
}

// listMunicipalities returns all the municipalities, for the organization form.
func (h *Handler) listMunicipalities(w http.ResponseWriter, r *http.Request) {
	rows, err := h.service.ListMunicipalities(r.Context())
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]municipalityResponse, len(rows))
	for i, m := range rows {
		out[i] = municipalityResponse(m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// listOrganizationMunicipalities returns the municipalities that have an
// organization, for the contact filter.
func (h *Handler) listOrganizationMunicipalities(w http.ResponseWriter, r *http.Request) {
	rows, err := h.service.ListMunicipalitiesWithOrganizations(r.Context())
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]httpx.Ref, len(rows))
	for i, m := range rows {
		out[i] = httpx.Ref(m)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

// listOrganizations searches organizations by name, municipality or CNPJ (?q=),
// in a municipality (?municipalityId=).
func (h *Handler) listOrganizations(w http.ResponseWriter, r *http.Request) {
	municipalityID, ok := filterID(r, "municipalityId")
	if !ok {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Filtro inválido.")
		return
	}
	orgs, err := h.service.SearchOrganizations(r.Context(), r.URL.Query().Get("q"), municipalityID)
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]organizationResponse, len(orgs))
	for i, o := range orgs {
		out[i] = toOrganizationResponse(o)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type organizationRequest struct {
	Name           string `json:"name" validate:"required"`
	CNPJ           string `json:"cnpj"`
	MunicipalityID int64  `json:"municipalityId"`
}

func (h *Handler) createOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	org, err := h.service.CreateOrganization(r.Context(), auth.CurrentUser(r.Context()).ID,
		OrganizationInput(req))
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toOrganizationResponse(org))
}

func (h *Handler) updateOrganization(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	var req organizationRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	org, err := h.service.UpdateOrganization(r.Context(), auth.CurrentUser(r.Context()).ID, id,
		OrganizationInput(req))
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toOrganizationResponse(org))
}

func WriteError(logger *slog.Logger, w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidName):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o nome.")
	case errors.Is(err, ErrInvalidCNPJ):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CNPJ inválido. Confira os 14 caracteres.")
	case errors.Is(err, ErrInvalidPhone):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o telefone com DDI e DDD, somente dígitos (ex.: 5511999990000).")
	case errors.Is(err, ErrOrganizationRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione o órgão do contato.")
	case errors.Is(err, ErrCNPJTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um órgão com este CNPJ.")
	case errors.Is(err, ErrOrganizationNameTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um órgão com este nome neste município.")
	case errors.Is(err, ErrMunicipalityRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione o município do órgão.")
	case errors.Is(err, ErrMunicipalityNotFound):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Município não encontrado. Selecione um da lista.")
	case errors.Is(err, ErrCNPJNotFound):
		httpx.WriteError(w, http.StatusNotFound, "CNPJ não encontrado na consulta. Preencha os dados manualmente.")
	case errors.Is(err, ErrCNPJLookupUnavailable):
		httpx.WriteError(w, http.StatusServiceUnavailable, "Consulta de CNPJ indisponível. Preencha os dados manualmente.")
	case errors.Is(err, ErrPhoneTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um contato com este telefone.")
	case errors.Is(err, ErrOrganizationNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Órgão não encontrado.")
	case errors.Is(err, ErrContactNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Contato não encontrado.")
	case errors.Is(err, ErrContactRegistered):
		httpx.WriteError(w, http.StatusConflict, "Contato já cadastrado. Altere o nome pelo cadastro do contato.")
	case errors.Is(err, ErrSectorRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione ao menos um setor.")
	case errors.Is(err, ErrInvalidSector):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha setores ativos.")
	case errors.Is(err, ErrSectorNotAllowed):
		httpx.WriteError(w, http.StatusForbidden, "Você altera somente o próprio setor do contato e o módulo dele.")
	case errors.Is(err, ErrOneModulePerSector):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha no máximo um módulo por setor.")
	case errors.Is(err, ErrInvalidModules):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos dos setores do contato.")
	default:
		httpx.InternalError(logger, w, r, err)
	}
}

type contactModuleResponse struct {
	ID       int64  `json:"id"`
	SectorID int64  `json:"sectorId"`
	Name     string `json:"name"`
}

type ContactResponse struct {
	ID           int64                   `json:"id"`
	Name         string                  `json:"name"`
	Phone        *string                 `json:"phone"`
	Registered   bool                    `json:"registered"`
	Organization *organizationResponse   `json:"organization"`
	Sectors      []httpx.Ref             `json:"sectors"`
	Modules      []contactModuleResponse `json:"modules"`
}

func ToContactResponse(c Contact) ContactResponse {
	out := ContactResponse{
		ID: c.ID, Name: c.Name, Phone: c.Phone, Registered: c.Registered,
		Sectors: make([]httpx.Ref, len(c.Sectors)),
		Modules: make([]contactModuleResponse, len(c.Modules)),
	}
	if c.OrganizationID != nil && c.OrganizationName != nil && c.MunicipalityID != nil && c.MunicipalityName != nil {
		out.Organization = &organizationResponse{
			ID: *c.OrganizationID, Name: *c.OrganizationName, CNPJ: c.OrganizationCNPJ,
			Municipality: httpx.Ref{ID: *c.MunicipalityID, Name: *c.MunicipalityName},
		}
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

// listContacts returns a page of the contacts (?page=, ?sort=name|organization,
// ?direction=asc|desc; by name by default) found by the name of the contact,
// organization or municipality, phone or CNPJ (?q=), in a sector (?sectorId=),
// module (?moduleId=), municipality (?municipalityId=) and organization
// (?organizationId=).
func (h *Handler) listContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, okSector := filterID(r, "sectorId")
	moduleID, okModule := filterID(r, "moduleId")
	municipalityID, okMunicipality := filterID(r, "municipalityId")
	organizationID, okOrganization := filterID(r, "organizationId")
	if !okSector || !okModule || !okMunicipality || !okOrganization {
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Filtro inválido.")
		return
	}
	contacts, total, page, err := h.service.SearchContacts(r.Context(), ContactFilter{
		Query: r.URL.Query().Get("q"), SectorID: sectorID, ModuleID: moduleID,
		MunicipalityID: municipalityID, OrganizationID: organizationID,
	}, paging.Parse(r, ContactSortColumns, SortContactName, false))
	if err != nil {
		httpx.InternalError(h.logger, w, r, err)
		return
	}
	out := make([]ContactResponse, len(contacts))
	for i, c := range contacts {
		out[i] = ToContactResponse(c)
	}
	httpx.WriteJSON(w, http.StatusOK, paging.NewPage(out, total, page))
}

func (h *Handler) getContact(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	c, err := h.service.GetContact(r.Context(), id)
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, ToContactResponse(c))
}

type ContactRequest struct {
	Name           string  `json:"name" validate:"required"`
	Phone          string  `json:"phone" validate:"required"`
	OrganizationID int64   `json:"organizationId" validate:"required"`
	SectorIDs      []int64 `json:"sectorIds" validate:"max=100"`
	ModuleIDs      []int64 `json:"moduleIds" validate:"max=500"`
}

func (req ContactRequest) Input() ContactInput {
	return ContactInput(req)
}

func (h *Handler) createContact(w http.ResponseWriter, r *http.Request) {
	var req ContactRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	c, err := h.service.CreateContact(r.Context(), auth.CurrentUser(r.Context()), req.Input())
	if err != nil {
		WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, ToContactResponse(c))
}
