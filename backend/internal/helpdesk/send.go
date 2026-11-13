package helpdesk

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

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/audio"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
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

// Outgoing is a message an agent sends from the panel: a text, a file with
// an optional caption, or audio recorded in the browser to go as a voice
// message (Voice), without caption.
type Outgoing struct {
	ClientRequestID pgtype.UUID
	Body            string
	File            *messaging.Media
	Voice           bool
}

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

// Messages returns the conversation of the ticket in the order it happened.
func (s *Service) Messages(ctx context.Context, actor auth.User, ticketID int64) ([]db.ListTicketMessagesRow, error) {
	if _, err := s.viewable(ctx, actor, ticketID); err != nil {
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
		file := *out.File
		msgType = fileType(file.MimeType)
		if out.Voice {
			data, seconds, err := audio.ToVoice(ctx, file.Data)
			if errors.Is(err, audio.ErrInvalid) {
				slog.Warn("convert recorded audio", "ticket_id", ticketID, "error", err)
				return db.Message{}, ErrInvalidAudio
			}
			if err != nil {
				return db.Message{}, fmt.Errorf("convert recorded audio: %w", err)
			}
			msgType, out.Body = messaging.TypeAudio, ""
			file = messaging.Media{Data: data, MimeType: audio.VoiceMimeType, DurationSeconds: seconds}
		}
		var err error
		media, err = s.storeMedia(ctx, file, time.Now())
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
		// The voice message goes without caption, so it has no prefix.
		body := optional(out.Body)
		if msgType != messaging.TypeAudio {
			prefixed, err := withNickname(ctx, q, actor.ID, out.Body)
			if err != nil {
				return err
			}
			body = &prefixed
		}
		msg, err = q.CreateAgentMessage(ctx, db.CreateAgentMessageParams{
			TicketID:        t.ID,
			SectorID:        t.SectorID,
			ContactID:       t.ContactID,
			AuthorID:        &actor.ID,
			Type:            db.MessageType(msgType),
			Body:            body,
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

// withNickname puts the current nickname of the sender before the text, as the
// client sees it. A blank text is an attachment without caption, since an empty
// text message was refused before getting here. The result is what gets
// recorded: retries and repeated requests never prefix it again.
func withNickname(ctx context.Context, q *db.Queries, userID int64, body string) (string, error) {
	nickname, err := q.GetUserNickname(ctx, userID)
	if err != nil {
		return "", fmt.Errorf("get nickname: %w", err)
	}
	return formatNickname(nickname, body), nil
}

func formatNickname(nickname, body string) string {
	if strings.TrimSpace(body) == "" {
		return "*" + nickname + ":*"
	}
	return "*" + nickname + ":*\n" + body
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
	if file.DurationSeconds != nil {
		media.DurationSeconds = int(*file.DurationSeconds)
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
