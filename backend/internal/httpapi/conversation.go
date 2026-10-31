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

type ticketDetailResponse struct {
	ID           int64                 `json:"id"`
	Protocol     string                `json:"protocol"`
	Status       db.TicketStatus       `json:"status"`
	Sector       ticketUserResponse    `json:"sector"`
	SpokeWith    *string               `json:"spokeWith"`
	ArrivedAt    time.Time             `json:"arrivedAt"`
	AssignedAt   *time.Time            `json:"assignedAt"`
	ClosedAt     *time.Time            `json:"closedAt"`
	Subject      *string               `json:"subject"`
	Resolution   *string               `json:"resolution"`
	Contact      ticketContactResponse `json:"contact"`
	Organization *ticketUserResponse   `json:"organization"`
	Assignee     *ticketUserResponse   `json:"assignee"`
}

type mediaResponse struct {
	ID        int64   `json:"id"`
	MimeType  string  `json:"mimeType"`
	FileName  *string `json:"fileName"`
	SizeBytes int64   `json:"sizeBytes"`
}

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
		out.Media = &mediaResponse{ID: *m.MediaID, MimeType: *m.MediaMimeType, FileName: m.MediaFileName, SizeBytes: *m.MediaSizeBytes}
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

type noteResponse struct {
	ID        int64              `json:"id"`
	Body      string             `json:"body"`
	CreatedAt time.Time          `json:"createdAt"`
	Author    ticketUserResponse `json:"author"`
}

type historyResponse struct {
	ID               int64           `json:"id"`
	Protocol         string          `json:"protocol"`
	Status           db.TicketStatus `json:"status"`
	SectorName       string          `json:"sectorName"`
	ArrivedAt        time.Time       `json:"arrivedAt"`
	ClosedAt         *time.Time      `json:"closedAt"`
	Subject          *string         `json:"subject"`
	ContactName      string          `json:"contactName"`
	OrganizationName *string         `json:"organizationName"`
	AssigneeName     *string         `json:"assigneeName"`
}

// ticketError answers the errors shared by the conversation routes.
func (s *server) ticketError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ticket.ErrNotFound):
		writeError(w, http.StatusNotFound, "Chamado não encontrado.")
	case errors.Is(err, ticket.ErrMessageNotFound):
		writeError(w, http.StatusNotFound, "Mensagem não encontrada.")
	case errors.Is(err, ticket.ErrMediaNotFound):
		writeError(w, http.StatusNotFound, "Arquivo não encontrado.")
	case errors.Is(err, ticket.ErrForbidden):
		writeError(w, http.StatusForbidden, "Você não tem acesso a este setor.")
	case errors.Is(err, ticket.ErrNotAssignee):
		writeError(w, http.StatusForbidden, "Apenas o responsável pelo chamado pode responder. Assuma o chamado ou peça a transferência.")
	case errors.Is(err, ticket.ErrClosed):
		writeError(w, http.StatusConflict, "Este chamado já foi encerrado.")
	case errors.Is(err, ticket.ErrRequestReused):
		writeError(w, http.StatusConflict, "Este envio já foi usado em outra mensagem. Tente novamente.")
	case errors.Is(err, ticket.ErrNotFailed):
		writeError(w, http.StatusConflict, "Esta mensagem não está com falha.")
	case errors.Is(err, ticket.ErrInvalidAudio):
		writeError(w, http.StatusUnprocessableEntity, "Não foi possível ler o áudio gravado. Grave novamente.")
	default:
		s.internalError(w, r, err)
	}
}

func (s *server) getTicket(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	t, err := s.tickets.Detail(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := ticketDetailResponse{
		ID: t.ID, Protocol: t.Protocol, Status: t.Status,
		Sector:    ticketUserResponse{ID: t.SectorID, Name: t.SectorName},
		SpokeWith: t.SpokeWith, ArrivedAt: t.ArrivedAt, AssignedAt: t.AssignedAt, ClosedAt: t.ClosedAt,
		Subject: t.Subject, Resolution: t.Resolution,
		Contact: ticketContactResponse{ID: t.ContactID, Name: t.ContactName, Phone: t.ContactPhone, Registered: t.ContactRegistered},
	}
	if t.OrganizationID != nil && t.OrganizationName != nil {
		out.Organization = &ticketUserResponse{ID: *t.OrganizationID, Name: *t.OrganizationName}
	}
	if t.AssigneeID != nil && t.AssigneeName != nil {
		out.Assignee = &ticketUserResponse{ID: *t.AssigneeID, Name: *t.AssigneeName}
	}
	writeJSON(w, http.StatusOK, out)
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

// getMedia serves an attachment to whoever may see its ticket.
func (s *server) getMedia(w http.ResponseWriter, r *http.Request) {
	mediaID, ok := urlID(w, r, "mediaID", "Arquivo não encontrado.")
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

type spokeWithRequest struct {
	SpokeWith string `json:"spokeWith" validate:"max=200"`
}

func (s *server) setSpokeWith(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req spokeWithRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	t, err := s.tickets.SetSpokeWith(r.Context(), currentUser(r.Context()), ticketID, req.SpokeWith)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"id": t.ID, "spokeWith": t.SpokeWith})
}

func (s *server) listNotes(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.Notes(r.Context(), currentUser(r.Context()), ticketID)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	out := make([]noteResponse, len(rows))
	for i, n := range rows {
		out[i] = noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: ticketUserResponse{ID: n.AuthorID, Name: n.AuthorName}}
	}
	writeJSON(w, http.StatusOK, out)
}

type noteRequest struct {
	Body string `json:"body" validate:"required,max=10000"`
}

func (s *server) createNote(w http.ResponseWriter, r *http.Request) {
	ticketID, ok := urlID(w, r, "ticketID", "Chamado não encontrado.")
	if !ok {
		return
	}
	var req noteRequest
	if !s.decodeJSON(w, r, &req) {
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" {
		writeError(w, http.StatusUnprocessableEntity, "Escreva a nota.")
		return
	}
	user := currentUser(r.Context())
	n, err := s.tickets.AddNote(r.Context(), user, ticketID, body)
	if err != nil {
		s.ticketError(w, r, err)
		return
	}
	writeJSON(w, http.StatusCreated, noteResponse{ID: n.ID, Body: n.Body, CreatedAt: n.CreatedAt, Author: ticketUserResponse{ID: user.ID, Name: user.Name}})
}

func writeHistory(w http.ResponseWriter, rows []ticket.HistoryEntry) {
	out := make([]historyResponse, len(rows))
	for i, t := range rows {
		out[i] = historyResponse{
			ID: t.ID, Protocol: t.Protocol, Status: t.Status, SectorName: t.SectorName,
			ArrivedAt: t.ArrivedAt, ClosedAt: t.ClosedAt, Subject: t.Subject,
			ContactName: t.ContactName, OrganizationName: t.OrganizationName, AssigneeName: t.AssigneeName,
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// contactHistory lists the tickets of the contact in the sectors of the user.
func (s *server) contactHistory(w http.ResponseWriter, r *http.Request) {
	contactID, ok := urlID(w, r, "contactID", "Contato não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.ContactHistory(r.Context(), currentUser(r.Context()), contactID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeHistory(w, rows)
}

// organizationHistory lists the tickets of the organization in the sectors of the user.
func (s *server) organizationHistory(w http.ResponseWriter, r *http.Request) {
	organizationID, ok := urlID(w, r, "organizationID", "Órgão não encontrado.")
	if !ok {
		return
	}
	rows, err := s.tickets.OrganizationHistory(r.Context(), currentUser(r.Context()), organizationID)
	if err != nil {
		s.internalError(w, r, err)
		return
	}
	writeHistory(w, rows)
}
