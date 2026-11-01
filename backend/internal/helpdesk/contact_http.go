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
