package helpdesk

import (
	"fmt"
	"io"
	"net/http"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

// getContactPhotoThumbnail serves the thumbnail of the contact picture, for
// the lists (spec #482).
func (h *Handler) getContactPhotoThumbnail(w http.ResponseWriter, r *http.Request) {
	h.serveContactPhoto(w, r, true)
}

// getContactPhoto serves the full picture of the contact, for the window that
// opens it.
func (h *Handler) getContactPhoto(w http.ResponseWriter, r *http.Request) {
	h.serveContactPhoto(w, r, false)
}

// serveContactPhoto serves one of the two files of the picture. The address
// carries ?v=<photoVersion>, which changes with the picture: the browser may
// keep the file forever and never shows the old one.
func (h *Handler) serveContactPhoto(w http.ResponseWriter, r *http.Request, thumbnail bool) {
	contactID, ok := httpx.URLID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	file, content, err := h.service.ContactPhoto(r.Context(), contactID, thumbnail)
	if err != nil {
		h.ticketError(w, r, err)
		return
	}
	defer func() { _ = content.Close() }()
	// The picture comes from a contact: the browser shows it inline but never
	// runs anything from it, and the file is private to the logged user.
	w.Header().Set("Content-Type", file.MimeType)
	w.Header().Set("Content-Disposition", "inline")
	w.Header().Set("Content-Security-Policy", "sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Header().Set("Content-Length", fmt.Sprint(file.SizeBytes))
	_, _ = io.Copy(w, content)
}
