package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
)

type organizationResponse struct {
	ID   int64   `json:"id"`
	Name string  `json:"name"`
	CNPJ *string `json:"cnpj"`
}

func toOrganizationResponse(o db.Organization) organizationResponse {
	return organizationResponse{ID: o.ID, Name: o.Name, CNPJ: o.Cnpj}
}

type contactResponse struct {
	ID           int64                 `json:"id"`
	Name         string                `json:"name"`
	Phone        *string               `json:"phone"`
	Registered   bool                  `json:"registered"`
	Organization *organizationResponse `json:"organization"`
}

func toContactResponse(c directory.Contact) contactResponse {
	out := contactResponse{ID: c.ID, Name: c.Name, Phone: c.Phone, Registered: c.Registered}
	if c.OrganizationID != nil && c.OrganizationName != nil {
		out.Organization = &organizationResponse{ID: *c.OrganizationID, Name: *c.OrganizationName, CNPJ: c.OrganizationCNPJ}
	}
	return out
}

// listOrganizations searches organizations by name or CNPJ (?q=).
func (s *server) listOrganizations(w http.ResponseWriter, r *http.Request) {
	orgs, err := s.directory.SearchOrganizations(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	out := make([]organizationResponse, len(orgs))
	for i, o := range orgs {
		out[i] = toOrganizationResponse(o)
	}
	writeJSON(w, http.StatusOK, out)
}

type organizationRequest struct {
	Name string `json:"name" validate:"required"`
	CNPJ string `json:"cnpj"`
}

func (s *server) createOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	org, err := s.directory.CreateOrganization(r.Context(), currentUser(r.Context()).ID,
		directory.OrganizationInput{Name: req.Name, CNPJ: req.CNPJ})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toOrganizationResponse(org))
}

func (s *server) updateOrganization(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	var req organizationRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	org, err := s.directory.UpdateOrganization(r.Context(), currentUser(r.Context()).ID, id,
		directory.OrganizationInput{Name: req.Name, CNPJ: req.CNPJ})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toOrganizationResponse(org))
}

// listContacts searches contacts by contact or organization name, phone or CNPJ (?q=).
func (s *server) listContacts(w http.ResponseWriter, r *http.Request) {
	contacts, err := s.directory.SearchContacts(r.Context(), r.URL.Query().Get("q"))
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	out := make([]contactResponse, len(contacts))
	for i, c := range contacts {
		out[i] = toContactResponse(c)
	}
	writeJSON(w, http.StatusOK, out)
}

type contactRequest struct {
	Name           string `json:"name" validate:"required"`
	Phone          string `json:"phone" validate:"required"`
	OrganizationID int64  `json:"organizationId" validate:"required"`
}

func (s *server) createContact(w http.ResponseWriter, r *http.Request) {
	var req contactRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	c, err := s.directory.CreateContact(r.Context(),
		directory.ContactInput{Name: req.Name, Phone: req.Phone, OrganizationID: req.OrganizationID})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, toContactResponse(c))
}

func (s *server) updateContact(w http.ResponseWriter, r *http.Request) {
	id, ok := urlID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	var req contactRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	// Pelo serviço de chamados: o cadastro completa o órgão dos chamados abertos do contato.
	c, err := s.tickets.RegisterContact(r.Context(), currentUser(r.Context()), id,
		directory.ContactInput{Name: req.Name, Phone: req.Phone, OrganizationID: req.OrganizationID})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toContactResponse(c))
}

func (s *server) directoryError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, directory.ErrInvalidName):
		writeError(w, http.StatusUnprocessableEntity, "Informe o nome.")
	case errors.Is(err, directory.ErrInvalidCNPJ):
		writeError(w, http.StatusUnprocessableEntity, "CNPJ inválido. Confira os 14 caracteres.")
	case errors.Is(err, directory.ErrInvalidPhone):
		writeError(w, http.StatusUnprocessableEntity, "Informe o telefone com DDI e DDD, somente dígitos (ex.: 5511999990000).")
	case errors.Is(err, directory.ErrOrganizationRequired):
		writeError(w, http.StatusUnprocessableEntity, "Selecione o órgão do contato.")
	case errors.Is(err, directory.ErrCNPJTaken):
		writeError(w, http.StatusConflict, "Já existe um órgão com este CNPJ.")
	case errors.Is(err, directory.ErrPhoneTaken):
		writeError(w, http.StatusConflict, "Já existe um contato com este telefone.")
	case errors.Is(err, directory.ErrOrganizationNotFound):
		writeError(w, http.StatusNotFound, "Órgão não encontrado.")
	case errors.Is(err, directory.ErrContactNotFound):
		writeError(w, http.StatusNotFound, "Contato não encontrado.")
	default:
		s.internalError(w, r, err)
	}
}
