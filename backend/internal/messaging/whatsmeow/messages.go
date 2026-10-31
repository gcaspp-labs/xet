package whatsmeow

import (
	"context"
	"fmt"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

// message emits a received message, or one sent from the phone of the sector.
func (s *session) message(evt *events.Message) bool {
	ctx, cancel := context.WithTimeout(context.Background(), eventTimeout)
	defer cancel()
	msg, ok, err := s.translate(ctx, evt)
	if err != nil {
		s.adapter.logger.Error("translate whatsapp message", "sector_id", s.sectorID, "message_id", evt.Info.ID, "error", err)
		return false
	}
	if !ok {
		return true
	}
	var ev messaging.Event = messaging.MessageReceived{SectorID: s.sectorID, Message: msg}
	if evt.Info.IsFromMe {
		ev = messaging.MessageSentOutside{SectorID: s.sectorID, Message: msg}
	}
	return s.adapter.emit(ev) == nil
}

// translate converts a Whatsmeow message into the neutral type, downloading
// its media. Edits and protocol messages (deletions, settings, key sharing)
// are outside the pilot and are skipped; other unknown kinds become
// unsupported, so they still show up in the history.
func (s *session) translate(ctx context.Context, evt *events.Message) (messaging.Message, bool, error) {
	info := evt.Info
	m := evt.Message
	if m == nil || evt.IsEdit || m.GetProtocolMessage() != nil || info.Chat == types.StatusBroadcastJID {
		return messaging.Message{}, false, nil
	}

	msg := messaging.Message{
		ExternalMessageID: info.ID,
		Group:             info.IsGroup,
		SentAt:            info.Timestamp,
	}
	if info.IsGroup {
		// Groups are ignored by the pilot: no contact and no download.
		return msg, true, nil
	}

	contact := s.contact(ctx, info)
	msg.ExternalContactID = contact.String()
	if contact.Server == types.DefaultUserServer {
		msg.Phone = contact.User
	}
	if !info.IsFromMe {
		msg.ContactName = info.PushName
	}

	var err error
	switch {
	case m.GetConversation() != "":
		msg.Type, msg.Body = messaging.TypeText, m.GetConversation()
	case m.GetExtendedTextMessage() != nil:
		msg.Type, msg.Body = messaging.TypeText, m.GetExtendedTextMessage().GetText()
	case m.GetImageMessage() != nil:
		img := m.GetImageMessage()
		msg.Type, msg.Body = messaging.TypeImage, img.GetCaption()
		msg.Media, err = s.download(ctx, img, img.GetMimetype(), "", 0)
	case m.GetVideoMessage() != nil:
		video := m.GetVideoMessage()
		msg.Type, msg.Body = messaging.TypeVideo, video.GetCaption()
		msg.Media, err = s.download(ctx, video, video.GetMimetype(), "", video.GetSeconds())
	case m.GetAudioMessage() != nil:
		audio := m.GetAudioMessage()
		msg.Type = messaging.TypeAudio
		msg.Media, err = s.download(ctx, audio, audio.GetMimetype(), "", audio.GetSeconds())
	case m.GetDocumentMessage() != nil:
		doc := m.GetDocumentMessage()
		msg.Type, msg.Body = messaging.TypeDocument, doc.GetCaption()
		msg.Media, err = s.download(ctx, doc, doc.GetMimetype(), doc.GetFileName(), 0)
	default:
		msg.Type = messaging.TypeUnsupported
	}
	if err != nil {
		return messaging.Message{}, false, err
	}
	return msg, true, nil
}

// contact returns the phone-number JID of the other side of a chat. WhatsApp
// may address the chat by LID; the phone JID comes from the message itself
// or from the LID mappings of the store, and the LID is kept otherwise.
func (s *session) contact(ctx context.Context, info types.MessageInfo) types.JID {
	chat := info.Chat.ToNonAD()
	if chat.Server != types.HiddenUserServer {
		return chat
	}
	alt := info.SenderAlt
	if info.IsFromMe {
		alt = info.RecipientAlt
	}
	if alt.Server == types.DefaultUserServer {
		return alt.ToNonAD()
	}
	if pn, err := s.client.Store.LIDs.GetPNForLID(ctx, chat); err == nil && !pn.IsEmpty() {
		return pn.ToNonAD()
	}
	return chat
}

func (s *session) download(ctx context.Context, msg whatsmeow.DownloadableMessage, mimeType, fileName string, seconds uint32) (*messaging.Media, error) {
	data, err := s.client.Download(ctx, msg)
	if err != nil {
		return nil, fmt.Errorf("download media: %w", err)
	}
	return &messaging.Media{Data: data, MimeType: mimeType, FileName: fileName, DurationSeconds: int(seconds)}, nil
}

// receipt reports the delivery of messages sent to a contact.
func (s *session) receipt(evt *events.Receipt) bool {
	if evt.IsGroup || evt.IsFromMe {
		return true
	}
	var status messaging.DeliveryStatus
	switch evt.Type {
	case types.ReceiptTypeDelivered:
		status = messaging.DeliveryDelivered
	case types.ReceiptTypeRead, types.ReceiptTypePlayed:
		status = messaging.DeliveryRead
	case types.ReceiptTypeServerError:
		status = messaging.DeliveryFailed
	default:
		return true
	}
	ids := make([]string, len(evt.MessageIDs))
	copy(ids, evt.MessageIDs)
	return s.adapter.emit(messaging.StatusUpdated{
		SectorID:           s.sectorID,
		ExternalMessageIDs: ids,
		Status:             status,
		At:                 evt.Timestamp,
	}) == nil
}

func (a *Adapter) SendText(ctx context.Context, msg messaging.TextMessage) (string, error) {
	return a.send(ctx, msg.SectorID, msg.To, msg.IdempotencyKey, func(context.Context, *whatsmeow.Client) (*waE2E.Message, error) {
		return &waE2E.Message{Conversation: proto.String(msg.Body)}, nil
	})
}

// SendMedia uploads the attachment to WhatsApp and sends it.
func (a *Adapter) SendMedia(ctx context.Context, msg messaging.MediaMessage) (string, error) {
	return a.send(ctx, msg.SectorID, msg.To, msg.IdempotencyKey, func(ctx context.Context, cli *whatsmeow.Client) (*waE2E.Message, error) {
		mediaType, ok := map[messaging.MessageType]whatsmeow.MediaType{
			messaging.TypeImage:    whatsmeow.MediaImage,
			messaging.TypeVideo:    whatsmeow.MediaVideo,
			messaging.TypeAudio:    whatsmeow.MediaAudio,
			messaging.TypeDocument: whatsmeow.MediaDocument,
		}[msg.Type]
		if !ok {
			return nil, fmt.Errorf("unsupported media type %q", msg.Type)
		}
		up, err := cli.Upload(ctx, msg.Media.Data, mediaType)
		if err != nil {
			return nil, fmt.Errorf("upload media: %w", err)
		}
		caption := optional(msg.Caption)
		mime := proto.String(msg.Media.MimeType)
		length := proto.Uint64(up.FileLength)
		seconds := proto.Uint32(uint32(max(msg.Media.DurationSeconds, 0)))
		switch msg.Type {
		case messaging.TypeImage:
			return &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption,
			}}, nil
		case messaging.TypeVideo:
			return &waE2E.Message{VideoMessage: &waE2E.VideoMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption, Seconds: seconds,
			}}, nil
		case messaging.TypeAudio:
			// Voice note: WhatsApp plays OGG/Opus with PTT set.
			return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Seconds: seconds, PTT: proto.Bool(true),
			}}, nil
		default:
			return &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption,
				FileName: optional(msg.Media.FileName), Title: optional(msg.Media.FileName),
			}}, nil
		}
	})
}

func (a *Adapter) send(ctx context.Context, sectorID int64, to, key string, build func(context.Context, *whatsmeow.Client) (*waE2E.Message, error)) (string, error) {
	cli, err := a.client(sectorID)
	if err != nil {
		return "", err
	}
	jid, err := types.ParseJID(to)
	if err != nil {
		return "", fmt.Errorf("parse recipient %q: %w", to, err)
	}
	msg, err := build(ctx, cli)
	if err != nil {
		return "", err
	}
	resp, err := cli.SendMessage(ctx, jid, msg, whatsmeow.SendRequestExtra{ID: messageID(cli, key)})
	if err != nil {
		return "", fmt.Errorf("send message: %w", err)
	}
	return resp.ID, nil
}

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
