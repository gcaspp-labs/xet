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
	case errors.Is(err, directory.ErrSectorRequired):
		writeError(w, http.StatusUnprocessableEntity, "Selecione ao menos um setor.")
	case errors.Is(err, directory.ErrInvalidSector):
		writeError(w, http.StatusUnprocessableEntity, "Escolha setores ativos.")
	case errors.Is(err, directory.ErrSectorNotAllowed):
		writeError(w, http.StatusForbidden, "Você altera somente o próprio setor do contato e o módulo dele.")
	case errors.Is(err, directory.ErrOneModulePerSector):
		writeError(w, http.StatusUnprocessableEntity, "Escolha no máximo um módulo por setor.")
	case errors.Is(err, directory.ErrInvalidModules):
		writeError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos dos setores do contato.")
	default:
		s.internalError(w, r, err)
	}
}
