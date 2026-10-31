package ticket

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

// MaxFileSize is the largest attachment sent through the panel (spec.md, Conversa).
const MaxFileSize = 16 << 20

// sendTimeout bounds a delivery to the provider, which goes on even if the
// request that started it is cancelled.
const sendTimeout = 2 * time.Minute

// Failure reasons shown to the agent next to a failed message.
const (
	reasonNotConnected    = "Número do setor desconectado."
	reasonContactNotFound = "Este telefone não tem WhatsApp."
	reasonProvider        = "O WhatsApp não aceitou a mensagem."
	reasonRestarted       = "O serviço foi reiniciado durante o envio."
)

var (
	ErrNotAssignee     = errors.New("user is not the assignee of the ticket")
	ErrRequestReused   = errors.New("client request id used by another message")
	ErrMessageNotFound = errors.New("message not found")
	ErrNotFailed       = errors.New("message has not failed")
	ErrMediaNotFound   = errors.New("media file not found")
)

// Outgoing is a message an agent sends from the panel: a text, or a file with
// an optional caption.
type Outgoing struct {
	ClientRequestID pgtype.UUID
	Body            string
	File            *messaging.Media
}

// HistoryEntry is a ticket in the history of a contact or an organization.
type HistoryEntry = db.ListContactTicketsRow

// fileType picks how an attachment goes to WhatsApp: JPEG and PNG as image,
// MP4 as video, anything else as a document with its file name.
func fileType(mimeType string) messaging.MessageType {
	switch strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0])) {
	case "image/jpeg", "image/png":
		return messaging.TypeImage
	case "video/mp4":
		return messaging.TypeVideo
	default:
		return messaging.TypeDocument
	}
}

// accessible returns the ticket when the user may see its sector.
func (s *Service) accessible(ctx context.Context, actor auth.User, ticketID int64) (db.Ticket, error) {
	t, err := s.q.GetTicket(ctx, ticketID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, ErrNotFound
	}
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get ticket: %w", err)
	}
	if !actor.CanAccessSector(t.SectorID) {
		return db.Ticket{}, ErrForbidden
	}
	return t, nil
}

// conducts checks, on the locked ticket, that the user may conduct the
// conversation: the ticket is open and the user is its assignee. Admins and
// supervisors are no exception (spec.md).
func conducts(t db.Ticket, actor auth.User) error {
	if t.Status == db.TicketStatusClosed {
		return ErrClosed
	}
	if t.AssigneeID == nil || *t.AssigneeID != actor.ID {
		return ErrNotAssignee
	}
	return nil
}

// Detail returns the ticket with its contact, organization and assignee.
func (s *Service) Detail(ctx context.Context, actor auth.User, ticketID int64) (db.GetTicketDetailRow, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.GetTicketDetailRow{}, err
	}
	d, err := s.q.GetTicketDetail(ctx, ticketID)
	if err != nil {
		return db.GetTicketDetailRow{}, fmt.Errorf("get ticket detail: %w", err)
	}
	return d, nil
}

// Messages returns the conversation of the ticket in the order it happened.
func (s *Service) Messages(ctx context.Context, actor auth.User, ticketID int64) ([]db.ListTicketMessagesRow, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketMessages(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list messages: %w", err)
	}
	return rows, nil
}

// Send records a message of the assignee as pending, commits, and only then
// hands it to the provider, updating its status with the result. The
// client_request_id makes a repeated request return the recorded message
// without sending it again.
func (s *Service) Send(ctx context.Context, provider messaging.Provider, actor auth.User, ticketID int64, out Outgoing) (db.Message, error) {
	if m, err := s.q.GetMessageByClientRequestID(ctx, out.ClientRequestID); err == nil {
		return repeated(m, actor, ticketID)
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return db.Message{}, fmt.Errorf("get message by request: %w", err)
	}
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Message{}, err
	}

	msgType := messaging.TypeText
	var media *db.CreateMediaFileParams
	if out.File != nil {
		msgType = fileType(out.File.MimeType)
		var err error
		media, err = s.storeMedia(ctx, *out.File, time.Now())
		if err != nil {
			return db.Message{}, err
		}
	}

	var msg db.Message
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		var mediaID *int64
		if media != nil {
			m, err := q.CreateMediaFile(ctx, *media)
			if err != nil {
				return fmt.Errorf("create media file: %w", err)
			}
			mediaID = &m.ID
		}
		msg, err = q.CreateAgentMessage(ctx, db.CreateAgentMessageParams{
			TicketID:        t.ID,
			SectorID:        t.SectorID,
			ContactID:       t.ContactID,
			AuthorID:        &actor.ID,
			Type:            db.MessageType(msgType),
			Body:            optional(out.Body),
			MediaID:         mediaID,
			ClientRequestID: out.ClientRequestID,
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return errDuplicate
		}
		if err != nil {
			return fmt.Errorf("create message: %w", err)
		}
		return nil
	})
	if errors.Is(err, errDuplicate) {
		// A concurrent request with the same client_request_id won.
		m, err := s.q.GetMessageByClientRequestID(ctx, out.ClientRequestID)
		if err != nil {
			return db.Message{}, fmt.Errorf("get message by request: %w", err)
		}
		return repeated(m, actor, ticketID)
	}
	if err != nil {
		return db.Message{}, err
	}
	s.hub.Publish(realtime.TicketChanged(msg.SectorID, msg.TicketID))
	return s.deliver(ctx, provider, msg), nil
}

// repeated returns the message of a repeated request, refusing a request ID
// that belongs to another ticket or author.
func repeated(m db.Message, actor auth.User, ticketID int64) (db.Message, error) {
	if m.TicketID != ticketID || m.AuthorID == nil || *m.AuthorID != actor.ID {
		return db.Message{}, ErrRequestReused
	}
	return m, nil
}

// Retry sends again a failed message of the ticket, with the same
// idempotency key, so the provider does not duplicate a message that went
// out before the failure was recorded. Only the assignee retries.
func (s *Service) Retry(ctx context.Context, provider messaging.Provider, actor auth.User, messageID int64) (db.Message, error) {
	current, err := s.q.GetMessage(ctx, messageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.Message{}, ErrMessageNotFound
	}
	if err != nil {
		return db.Message{}, fmt.Errorf("get message: %w", err)
	}
	if _, err := s.accessible(ctx, actor, current.TicketID); err != nil {
		return db.Message{}, err
	}
	if current.Origin != db.MessageOriginAgent {
		return db.Message{}, ErrNotFailed
	}

	var msg db.Message
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, current.TicketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		msg, err = q.RetryMessage(ctx, messageID)
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFailed
		}
		if err != nil {
			return fmt.Errorf("retry message: %w", err)
		}
		return nil
	})
	if err != nil {
		return db.Message{}, err
	}
	s.hub.Publish(realtime.TicketChanged(msg.SectorID, msg.TicketID))
	return s.deliver(ctx, provider, msg), nil
}

// deliver hands a pending message to the provider, outside any transaction,
// and records the result. A failure is recorded on the message, which the
// agent may retry; it is not an error of the request.
func (s *Service) deliver(ctx context.Context, provider messaging.Provider, msg db.Message) db.Message {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), sendTimeout)
	defer cancel()

	externalID, err := s.send(ctx, provider, msg)
	var updated db.Message
	if err == nil {
		updated, err = s.q.MarkMessageSent(ctx, db.MarkMessageSentParams{ID: msg.ID, ExternalMessageID: &externalID})
	} else {
		slog.Warn("send message", "message_id", msg.ID, "error", err)
		reason := failureReason(err)
		updated, err = s.q.MarkMessageFailed(ctx, db.MarkMessageFailedParams{ID: msg.ID, FailureReason: &reason})
	}
	if err != nil {
		// Marked failed by a restart meanwhile, or the database is gone: the
		// message stays as it is and the panel shows its current status.
		slog.Error("record send result", "message_id", msg.ID, "error", err)
		if m, getErr := s.q.GetMessage(ctx, msg.ID); getErr == nil {
			updated = m
		} else {
			updated = msg
		}
	}
	s.hub.Publish(realtime.TicketChanged(msg.SectorID, msg.TicketID))
	return updated
}

func (s *Service) send(ctx context.Context, provider messaging.Provider, msg db.Message) (string, error) {
	contact, err := s.q.GetContactWithOrganization(ctx, msg.ContactID)
	if err != nil {
		return "", fmt.Errorf("get contact: %w", err)
	}
	to := ""
	switch {
	case contact.Contact.ExternalContactID != nil:
		to = *contact.Contact.ExternalContactID
	case contact.Contact.Phone != nil:
		to, err = provider.ResolveContact(ctx, msg.SectorID, *contact.Contact.Phone)
		if err != nil {
			return "", err
		}
	default:
		return "", messaging.ErrContactNotFound
	}
	key := msg.ClientRequestID.String()
	body := ""
	if msg.Body != nil {
		body = *msg.Body
	}

	if msg.MediaID == nil {
		return provider.SendText(ctx, messaging.TextMessage{SectorID: msg.SectorID, To: to, Body: body, IdempotencyKey: key})
	}
	file, err := s.q.GetMediaFile(ctx, *msg.MediaID)
	if err != nil {
		return "", fmt.Errorf("get media file: %w", err)
	}
	data, err := s.readFile(ctx, file.StorageKey)
	if err != nil {
		return "", err
	}
	media := messaging.Media{Data: data, MimeType: file.MimeType}
	if file.FileName != nil {
		media.FileName = *file.FileName
	}
	return provider.SendMedia(ctx, messaging.MediaMessage{
		SectorID: msg.SectorID, To: to, Type: messaging.MessageType(msg.Type), Media: media, Caption: body, IdempotencyKey: key,
	})
}

func (s *Service) readFile(ctx context.Context, key string) ([]byte, error) {
	r, err := s.storage.Open(ctx, key)
	if err != nil {
		return nil, fmt.Errorf("open media: %w", err)
	}
	defer func() { _ = r.Close() }()
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, fmt.Errorf("read media: %w", err)
	}
	return data, nil
}

func failureReason(err error) string {
	switch {
	case errors.Is(err, messaging.ErrNotConnected):
		return reasonNotConnected
	case errors.Is(err, messaging.ErrContactNotFound):
		return reasonContactNotFound
	default:
		return reasonProvider
	}
}

// FailPending marks the messages left pending by a previous run as failed,
// for the agents to retry. It runs when the service starts, before the API
// accepts requests.
func (s *Service) FailPending(ctx context.Context) (int64, error) {
	reason := reasonRestarted
	n, err := s.q.FailPendingMessages(ctx, &reason)
	if err != nil {
		return 0, fmt.Errorf("fail pending messages: %w", err)
	}
	return n, nil
}

// HandleStatus records the delivery progress reported by the provider.
func (s *Service) HandleStatus(ctx context.Context, ev messaging.StatusUpdated) error {
	if len(ev.ExternalMessageIDs) == 0 {
		return nil
	}
	var tickets []int64
	var err error
	switch ev.Status {
	case messaging.DeliveryFailed:
		reason := reasonProvider
		tickets, err = s.q.FailSentMessages(ctx, db.FailSentMessagesParams{
			FailureReason: &reason, SectorID: ev.SectorID, ExternalMessageIds: ev.ExternalMessageIDs,
		})
	case messaging.DeliverySent, messaging.DeliveryDelivered, messaging.DeliveryRead:
		tickets, err = s.q.AdvanceMessageStatus(ctx, db.AdvanceMessageStatusParams{
			Status:             db.NullMessageStatus{MessageStatus: db.MessageStatus(ev.Status), Valid: true},
			SectorID:           ev.SectorID,
			ExternalMessageIds: ev.ExternalMessageIDs,
		})
	default:
		return fmt.Errorf("unknown delivery status %q", ev.Status)
	}
	if err != nil {
		return fmt.Errorf("update message status: %w", err)
	}
	seen := map[int64]bool{}
	for _, id := range tickets {
		if !seen[id] {
			seen[id] = true
			s.hub.Publish(realtime.TicketChanged(ev.SectorID, id))
		}
	}
	return nil
}

// SetSpokeWith records who the assignee talked to, for phones shared by more
// than one person. An empty value clears it.
func (s *Service) SetSpokeWith(ctx context.Context, actor auth.User, ticketID int64, spokeWith string) (db.Ticket, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return db.Ticket{}, err
	}
	var ticket db.Ticket
	err := pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		t, err := q.GetTicketForUpdate(ctx, ticketID)
		if err != nil {
			return fmt.Errorf("lock ticket: %w", err)
		}
		if err := conducts(t, actor); err != nil {
			return err
		}
		ticket, err = q.SetTicketSpokeWith(ctx, db.SetTicketSpokeWithParams{ID: ticketID, SpokeWith: optional(strings.TrimSpace(spokeWith))})
		if err != nil {
			return fmt.Errorf("set spoke with: %w", err)
		}
		return nil
	})
	if err != nil {
		return db.Ticket{}, err
	}
	s.hub.Publish(realtime.TicketChanged(ticket.SectorID, ticket.ID))
	return ticket, nil
}

// Notes returns the internal notes of the ticket, oldest first.
func (s *Service) Notes(ctx context.Context, actor auth.User, ticketID int64) ([]db.ListTicketNotesRow, error) {
	if _, err := s.accessible(ctx, actor, ticketID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListTicketNotes(ctx, ticketID)
	if err != nil {
		return nil, fmt.Errorf("list notes: %w", err)
	}
	return rows, nil
}

// AddNote records an internal note. Anyone who sees the ticket may write
// one, even without being the assignee and after closing (spec.md).
func (s *Service) AddNote(ctx context.Context, actor auth.User, ticketID int64, body string) (db.InternalNote, error) {
	t, err := s.accessible(ctx, actor, ticketID)
	if err != nil {
		return db.InternalNote{}, err
	}
	note, err := s.q.CreateInternalNote(ctx, db.CreateInternalNoteParams{TicketID: ticketID, AuthorID: actor.ID, Body: body})
	if err != nil {
		return db.InternalNote{}, fmt.Errorf("create note: %w", err)
	}
	s.hub.Publish(realtime.TicketChanged(t.SectorID, t.ID))
	return note, nil
}

// Media opens an attachment of a message of a ticket the user may see.
func (s *Service) Media(ctx context.Context, actor auth.User, mediaID int64) (db.MediaFile, io.ReadCloser, error) {
	sectorID, err := s.q.GetMediaFileSector(ctx, &mediaID)
	if errors.Is(err, pgx.ErrNoRows) {
		return db.MediaFile{}, nil, ErrMediaNotFound
	}
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("get media sector: %w", err)
	}
	if !actor.CanAccessSector(sectorID) {
		return db.MediaFile{}, nil, ErrForbidden
	}
	file, err := s.q.GetMediaFile(ctx, mediaID)
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("get media file: %w", err)
	}
	r, err := s.storage.Open(ctx, file.StorageKey)
	if err != nil {
		return db.MediaFile{}, nil, fmt.Errorf("open media: %w", err)
	}
	return file, r, nil
}

// historySector limits a history to the sector of the user; nil for an
// admin, who sees every sector.
func historySector(actor auth.User) *int64 {
	if actor.Role == db.UserRoleAdmin {
		return nil
	}
	return actor.SectorID
}

// ContactHistory lists the tickets of the contact in the sectors the user
// may see, newest first.
func (s *Service) ContactHistory(ctx context.Context, actor auth.User, contactID int64) ([]HistoryEntry, error) {
	rows, err := s.q.ListContactTickets(ctx, db.ListContactTicketsParams{ContactID: contactID, SectorID: historySector(actor)})
	if err != nil {
		return nil, fmt.Errorf("list contact tickets: %w", err)
	}
	return rows, nil
}

// OrganizationHistory lists the tickets of the organization in the sectors
// the user may see, newest first.
func (s *Service) OrganizationHistory(ctx context.Context, actor auth.User, organizationID int64) ([]HistoryEntry, error) {
	rows, err := s.q.ListOrganizationTickets(ctx, db.ListOrganizationTicketsParams{OrganizationID: &organizationID, SectorID: historySector(actor)})
	if err != nil {
		return nil, fmt.Errorf("list organization tickets: %w", err)
	}
	out := make([]HistoryEntry, len(rows))
	for i, r := range rows {
		out[i] = HistoryEntry(r)
	}
	return out, nil
}
