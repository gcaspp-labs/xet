package helpdesk

import (
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

func (h *Handler) updateContact(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	var req directory.ContactRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	// Pelo serviço de chamados: o cadastro completa o órgão dos chamados abertos do contato.
	c, err := h.service.RegisterContact(r.Context(), auth.CurrentUser(r.Context()), id, req.Input())
	if err != nil {
		directory.WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, directory.ToContactResponse(c))
}

type contactNameRequest struct {
	Name string `json:"name" validate:"required"`
}

// setContactName saves only the name of an unregistered contact, during the
// conversation; the contact stays unregistered and, like the contact edit, the
// change is not audited.
func (h *Handler) setContactName(w http.ResponseWriter, r *http.Request) {
	id, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	var req contactNameRequest
	if !httpx.DecodeJSON(w, r, &req) {
		return
	}
	c, err := h.service.SaveContactName(r.Context(), id, req.Name)
	if err != nil {
		directory.WriteError(h.logger, w, r, err)
		return
	}
	httpx.WriteJSON(w, http.StatusOK, directory.ToContactResponse(c))
}
