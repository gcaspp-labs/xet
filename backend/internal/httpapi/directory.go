package httpapi

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
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
		httpx.InternalError(s.logger, w, r, err)
		return
	}
	out := make([]organizationResponse, len(orgs))
	for i, o := range orgs {
		out[i] = toOrganizationResponse(o)
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type organizationRequest struct {
	Name string `json:"name" validate:"required"`
	CNPJ string `json:"cnpj"`
}

func (s *server) createOrganization(w http.ResponseWriter, r *http.Request) {
	var req organizationRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	org, err := s.directory.CreateOrganization(r.Context(), currentUser(r.Context()).ID,
		directory.OrganizationInput{Name: req.Name, CNPJ: req.CNPJ})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusCreated, toOrganizationResponse(org))
}

func (s *server) updateOrganization(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	var req organizationRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	org, err := s.directory.UpdateOrganization(r.Context(), currentUser(r.Context()).ID, id,
		directory.OrganizationInput{Name: req.Name, CNPJ: req.CNPJ})
	if err != nil {
		s.directoryError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, toOrganizationResponse(org))
}

func (s *server) directoryError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, directory.ErrInvalidName):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o nome.")
	case errors.Is(err, directory.ErrInvalidCNPJ):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "CNPJ inválido. Confira os 14 caracteres.")
	case errors.Is(err, directory.ErrInvalidPhone):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Informe o telefone com DDI e DDD, somente dígitos (ex.: 5511999990000).")
	case errors.Is(err, directory.ErrOrganizationRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione o órgão do contato.")
	case errors.Is(err, directory.ErrCNPJTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um órgão com este CNPJ.")
	case errors.Is(err, directory.ErrPhoneTaken):
		httpx.WriteError(w, http.StatusConflict, "Já existe um contato com este telefone.")
	case errors.Is(err, directory.ErrOrganizationNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Órgão não encontrado.")
	case errors.Is(err, directory.ErrContactNotFound):
		httpx.WriteError(w, http.StatusNotFound, "Contato não encontrado.")
	case errors.Is(err, directory.ErrSectorRequired):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione ao menos um setor.")
	case errors.Is(err, directory.ErrInvalidSector):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha setores ativos.")
	case errors.Is(err, directory.ErrSectorNotAllowed):
		httpx.WriteError(w, http.StatusForbidden, "Você altera somente o próprio setor do contato e o módulo dele.")
	case errors.Is(err, directory.ErrOneModulePerSector):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha no máximo um módulo por setor.")
	case errors.Is(err, directory.ErrInvalidModules):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Escolha módulos ativos dos setores do contato.")
	case errors.Is(err, directory.ErrNoContactsChosen):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione ao menos um contato.")
	case errors.Is(err, directory.ErrNoContactBook):
		httpx.WriteError(w, http.StatusConflict, "Este número não oferece a agenda de contatos. Cadastre os contatos manualmente.")
	case errors.Is(err, messaging.ErrNotConnected):
		httpx.WriteError(w, http.StatusConflict, "Número desconectado. Reconecte pelo QR code.")
	default:
		httpx.InternalError(s.logger, w, r, err)
	}
}
