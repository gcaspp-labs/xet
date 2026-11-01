package helpdesk

import (
	"errors"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

type savedContactResponse struct {
	Name  string `json:"name"`
	Phone string `json:"phone"`
	// Exists reports a contact with this phone, with or without the ninth digit.
	Exists bool `json:"exists"`
}

// listSavedContacts shows the address book of the sector number, to choose whom to import.
func (h *Handler) listSavedContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	saved, err := h.service.ListSavedContacts(r.Context(), h.provider, sectorID)
	if err != nil {
		h.contactImportError(w, r, err)
		return
	}
	out := make([]savedContactResponse, len(saved))
	for i, c := range saved {
		out[i] = savedContactResponse{Name: c.Name, Phone: c.Phone, Exists: c.Exists}
	}
	httpx.WriteJSON(w, http.StatusOK, out)
}

type importContactsRequest struct {
	// Phones are the chosen entries; the names are read again by the service.
	Phones         []string `json:"phones" validate:"max=10000"`
	OrganizationID int64    `json:"organizationId"`
}

type importContactsResponse struct {
	Created     int `json:"created"`
	Existing    int `json:"existing"`
	Unavailable int `json:"unavailable"`
}

func (h *Handler) importContacts(w http.ResponseWriter, r *http.Request) {
	sectorID, ok := httpx.URLID(w, r, "sectorID", "Setor não encontrado.")
	if !ok {
		return
	}
	var req importContactsRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	result, err := h.service.ImportContacts(r.Context(), h.provider, auth.CurrentUser(r.Context()), sectorID,
		ImportInput(req))
	if err != nil {
		h.contactImportError(w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, importContactsResponse(result))
}

func (h *Handler) contactImportError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrNoContactsChosen):
		httpx.WriteError(w, http.StatusUnprocessableEntity, "Selecione ao menos um contato.")
	case errors.Is(err, ErrNoContactBook):
		httpx.WriteError(w, http.StatusConflict, "Este número não oferece a agenda de contatos. Cadastre os contatos manualmente.")
	case errors.Is(err, messaging.ErrNotConnected):
		httpx.WriteError(w, http.StatusConflict, "Número desconectado. Reconecte pelo QR code.")
	default:
		directory.WriteError(h.logger, w, r, err)
	}
}
