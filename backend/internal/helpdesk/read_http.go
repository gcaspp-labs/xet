package helpdesk

import (
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
)

// markRead records the reading of the assignee. It always answers success for
// a ticket the user may see: for another user or another state, nothing
// changes, so the screen of whoever opened the ticket does not fail.
func (h *Handler) markRead(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlTicketID(w, r)
	if !ok {
		return
	}
	if err := h.service.MarkRead(r.Context(), auth.CurrentUser(r.Context()), ticketID); err != nil {
		h.ticketError(w, r, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
