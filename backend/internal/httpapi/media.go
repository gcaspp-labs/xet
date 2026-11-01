package httpapi

import (
	"fmt"
	"io"
	"mime"
	"net/http"
	"strings"

	"github.com/gcaspp-labs/xet/backend/internal/core/httpx"
)

type mediaResponse struct {
	ID        int64   `json:"id"`
	MimeType  string  `json:"mimeType"`
	FileName  *string `json:"fileName"`
	SizeBytes int64   `json:"sizeBytes"`
	// DurationSeconds is set for audio and video, when the provider reports it.
	DurationSeconds *int32 `json:"durationSeconds"`
}

// getMedia serves an attachment to whoever may see its ticket.
func (s *server) getMedia(w http.ResponseWriter, r *http.Request) {
	mediaID, ok := httpx.URLID(w, r, "mediaID", "Arquivo não encontrado.")
	if !ok {
		return
	}
	file, content, err := s.tickets.Media(r.Context(), currentUser(r.Context()), mediaID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	defer func() { _ = content.Close() }()
	name := fmt.Sprintf("arquivo-%d", file.ID)
	if file.FileName != nil {
		name = *file.FileName
	}
	// Files come from contacts: only media opens in the browser, anything
	// else (HTML, SVG) is downloaded and runs in a sandbox if opened.
	disposition := "attachment"
	if isPlayable(file.MimeType) {
		disposition = "inline"
	}
	w.Header().Set("Content-Type", file.MimeType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": name}))
	w.Header().Set("Content-Security-Policy", "sandbox")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=86400")
	// Byte ranges let the audio and video players seek; the disk storage
	// supports them, other storages send the whole file.
	if seeker, ok := content.(io.ReadSeeker); ok {
		http.ServeContent(w, r, "", file.CreatedAt, seeker)
		return
	}
	w.Header().Set("Content-Length", fmt.Sprint(file.SizeBytes))
	_, _ = io.Copy(w, content)
}

func isPlayable(mimeType string) bool {
	switch {
	case strings.HasPrefix(mimeType, "image/svg"):
		return false
	case strings.HasPrefix(mimeType, "image/"), strings.HasPrefix(mimeType, "video/"), strings.HasPrefix(mimeType, "audio/"):
		return true
	default:
		return mimeType == "application/pdf"
	}
}
