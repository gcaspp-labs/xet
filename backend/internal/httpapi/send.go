package httpapi

import (
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/ticket"
)

// Room for the multipart headers and the text fields around the file.
const multipartOverhead = 1 << 20

type messageResponse struct {
	ID            int64               `json:"id"`
	TicketID      int64               `json:"ticketId"`
	Direction     db.MessageDirection `json:"direction"`
	Origin        db.MessageOrigin    `json:"origin"`
	Type          db.MessageType      `json:"type"`
	Body          *string             `json:"body"`
	Status        *db.MessageStatus   `json:"status"`
	FailureReason *string             `json:"failureReason"`
	SentAt        time.Time           `json:"sentAt"`
	Author        *ticketUserResponse `json:"author"`
	Media         *mediaResponse      `json:"media"`
}

func toMessageResponse(m db.ListTicketMessagesRow) messageResponse {
	out := messageResponse{
		ID: m.ID, TicketID: m.TicketID, Direction: m.Direction, Origin: m.Origin, Type: m.Type,
		Body: m.Body, FailureReason: m.FailureReason, SentAt: m.SentAt,
	}
	if m.Status.Valid {
		out.Status = &m.Status.MessageStatus
	}
	if m.AuthorID != nil && m.AuthorName != nil {
		out.Author = &ticketUserResponse{ID: *m.AuthorID, Name: *m.AuthorName}
	}
	if m.MediaID != nil && m.MediaMimeType != nil && m.MediaSizeBytes != nil {
		out.Media = &mediaResponse{ID: *m.MediaID, MimeType: *m.MediaMimeType, FileName: m.MediaFileName, SizeBytes: *m.MediaSizeBytes, DurationSeconds: m.MediaDurationSeconds}
	}
	return out
}

// sentMessageResponse is the message right after a send or retry; the panel
// reloads the conversation for the author name and the file details.
type sentMessageResponse struct {
	ID            int64             `json:"id"`
	TicketID      int64             `json:"ticketId"`
	Status        *db.MessageStatus `json:"status"`
	FailureReason *string           `json:"failureReason"`
}

func toSentMessageResponse(m db.Message) sentMessageResponse {
	out := sentMessageResponse{ID: m.ID, TicketID: m.TicketID, FailureReason: m.FailureReason}
	if m.Status.Valid {
		out.Status = &m.Status.MessageStatus
	}
	return out
}

func (s *server) listMessages(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.Messages(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]messageResponse, len(rows))
	for i, m := range rows {
		out[i] = toMessageResponse(m)
	}
	writeJSON(w, http.StatusOK, out)
}

type textMessageRequest struct {
	ClientRequestID string `json:"clientRequestId" validate:"required,uuid"`
	Body            string `json:"body" validate:"required,max=65536"`
}

// sendMessage sends a text (JSON) or a file (multipart, fields
// clientRequestId, file and an optional caption) to the contact.
func (s *server) sendMessage(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var out ticket.Outgoing
	mediaType, _, _ := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if mediaType == "multipart/form-data" {
		if out, ok = s.readFileMessage(w, r); !ok {
			return
		}
	} else {
		var req textMessageRequest
		if !s.decodeJSON(w, r, &req) {
			return
		}
		if strings.TrimSpace(req.Body) == "" {
			writeError(w, http.StatusUnprocessableEntity, "Escreva a mensagem.")
			return
		}
		out.Body = req.Body
		if !parseRequestID(w, req.ClientRequestID, &out.ClientRequestID) {
			return
		}
	}

	msg, err := s.tickets.Send(r.Context(), s.opts.Messaging, currentUser(r.Context()), ticketID, out)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toSentMessageResponse(msg))
}

func (s *server) readFileMessage(w http.ResponseWriter, r *http.Request) (ticket.Outgoing, bool) {
	var out ticket.Outgoing
	tooLarge := fmt.Sprintf("O arquivo passa de %d MB.", ticket.MaxFileSize>>20)
	r.Body = http.MaxBytesReader(w, r.Body, ticket.MaxFileSize+multipartOverhead)
	if err := r.ParseMultipartForm(ticket.MaxFileSize + multipartOverhead); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			writeError(w, http.StatusRequestEntityTooLarge, tooLarge)
		} else {
			writeError(w, http.StatusBadRequest, "Requisição inválida.")
		}
		return out, false
	}
	defer func() { _ = r.MultipartForm.RemoveAll() }()

	if !parseRequestID(w, r.FormValue("clientRequestId"), &out.ClientRequestID) {
		return out, false
	}
	// A recording to go as a voice message comes in the voice field.
	file, header, err := r.FormFile("file")
	if errors.Is(err, http.ErrMissingFile) {
		file, header, err = r.FormFile("voice")
		out.Voice = err == nil
	}
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Escolha um arquivo.")
		return out, false
	}
	defer func() { _ = file.Close() }()
	if header.Size > ticket.MaxFileSize {
		writeError(w, http.StatusRequestEntityTooLarge, tooLarge)
		return out, false
	}
	data, err := io.ReadAll(file)
	if err != nil {
		s.internalError(w, r, err)
		return out, false
	}
	if len(data) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "O arquivo está vazio.")
		return out, false
	}
	mimeType := header.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}
	if !out.Voice {
		out.Body = strings.TrimSpace(r.FormValue("caption"))
	}
	out.File = &messaging.Media{Data: data, MimeType: mimeType, FileName: filepath.Base(header.Filename)}
	return out, true
}

func parseRequestID(w http.ResponseWriter, raw string, dst *pgtype.UUID) bool {
	if err := dst.Scan(raw); err != nil || !dst.Valid {
		writeError(w, http.StatusUnprocessableEntity, "Identificador de envio inválido.")
		return false
	}
	return true
}

func (s *server) retryMessage(w http.ResponseWriter, r *http.Request) {
	messageID, ok := urlID(w, r, "messageID", "Mensagem não encontrada.")
	if !ok {
		return
	}
	msg, err := s.tickets.Retry(r.Context(), s.opts.Messaging, currentUser(r.Context()), messageID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, toSentMessageResponse(msg))
}
