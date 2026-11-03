package directory

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type cnpjSuggestionResponse struct {
	Name         string     `json:"name"`
	Municipality *httpx.Ref `json:"municipality"`
}

func (h *Handler) lookupCNPJ(w http.ResponseWriter, r *http.Request) {
	suggestion, err := h.service.LookupCNPJ(r.Context(), chi.URLParam(r, "cnpj"))
	if err != nil {
		if errors.Is(err, ErrCNPJLookupUnavailable) {
			h.logger.Warn("cnpj lookup", "error", err)
		}
		WriteError(h.logger, w, r, err)
		return
	}
	response := cnpjSuggestionResponse{Name: suggestion.Name}
	if m := suggestion.Municipality; m != nil {
		response.Municipality = &httpx.Ref{ID: m.ID, Name: m.Name}
	}
	httpx.WriteJSON(w, http.StatusOK, response)
}
