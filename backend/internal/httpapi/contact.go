package httpapi

import (
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/directory"
)

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
