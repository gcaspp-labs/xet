package whatsmeow

import (
	"context"
	"fmt"
	"time"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	"google.golang.org/protobuf/proto"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	downloadAttempts   = 3
	downloadTimeout    = 2 * time.Minute
	downloadRetryDelay = 2 * time.Second
)

// downloadable is a media message that reports the size of its file.
type downloadable interface {
	whatsmeow.DownloadableMessage
	GetFileLength() uint64
}

// message emits a received message, or one sent from the phone of the sector.
func (s *session) message(evt *events.Message) bool {
	ctx, cancel := context.WithTimeout(context.Background(), eventTimeout)
	defer cancel()
	if reaction := evt.Message.GetReactionMessage(); reaction != nil && !evt.IsEdit {
		return s.reaction(ctx, evt, reaction)
	}
	if pm := evt.Message.GetProtocolMessage(); pm != nil {
		switch pm.GetType() {
		case waE2E.ProtocolMessage_MESSAGE_EDIT:
			return s.edit(ctx, evt, pm)
		case waE2E.ProtocolMessage_REVOKE:
			return s.revoke(ctx, evt, pm)
		}
	}
	msg, ok := s.translate(ctx, evt)
	if !ok {
		return true
	}
	var ev messaging.Event = messaging.MessageReceived{SectorID: s.sectorID, Message: msg}
	if evt.Info.IsFromMe {
		ev = messaging.MessageSentOutside{SectorID: s.sectorID, Message: msg}
	}
	return s.adapter.emit(ev) == nil
}

// reaction emits a reaction to a message of a chat. The reaction text is the
// emoji, empty when the author removes it.
func (s *session) reaction(ctx context.Context, evt *events.Message, reaction *waE2E.ReactionMessage) bool {
	info := evt.Info
	target := reaction.GetKey().GetID()
	if target == "" || info.Chat == types.StatusBroadcastJID {
		return true
	}
	ev := messaging.ReactionReceived{
		SectorID:                s.sectorID,
		TargetExternalMessageID: target,
		Group:                   info.IsGroup,
		Emoji:                   reaction.GetText(),
		FromSectorPhone:         info.IsFromMe,
		At:                      info.Timestamp,
	}
	if !info.IsGroup {
		contact := s.contact(ctx, info)
		ev.ExternalContactID = contact.String()
		if contact.Server == types.DefaultUserServer {
			ev.Phone = contact.User
		}
	}
	return s.adapter.emit(ev) == nil
}

// edit emits the new text or caption of a message, made by the contact or
// from the phone of the sector. Whatsmeow delivers it as a protocol message
// with the key of the target, unwrapped from the edited message. An edit
// without text or caption (a reaction edit, a poll) is skipped.
func (s *session) edit(ctx context.Context, evt *events.Message, pm *waE2E.ProtocolMessage) bool {
	info := evt.Info
	target := pm.GetKey().GetID()
	body, ok := editedBody(pm.GetEditedMessage())
	if target == "" || !ok || info.Chat == types.StatusBroadcastJID {
		return true
	}
	ev := messaging.MessageEdited{
		SectorID:                s.sectorID,
		ExternalEventID:         info.ID,
		TargetExternalMessageID: target,
		Group:                   info.IsGroup,
		FromSector:              info.IsFromMe,
		Body:                    body,
		At:                      info.Timestamp,
	}
	if ms := pm.GetTimestampMS(); ms > 0 {
		ev.At = time.UnixMilli(ms)
	}
	if !info.IsGroup {
		ev.ExternalContactID, ev.Phone = s.chatContact(ctx, info)
	}
	return s.adapter.emit(ev) == nil
}

// revoke emits a message deleted for everyone by the contact or from the
// phone of the sector.
func (s *session) revoke(ctx context.Context, evt *events.Message, pm *waE2E.ProtocolMessage) bool {
	info := evt.Info
	target := pm.GetKey().GetID()
	if target == "" || info.Chat == types.StatusBroadcastJID {
		return true
	}
	ev := messaging.MessageRevoked{
		SectorID:                s.sectorID,
		ExternalEventID:         info.ID,
		TargetExternalMessageID: target,
		Group:                   info.IsGroup,
		FromSector:              info.IsFromMe,
		At:                      info.Timestamp,
	}
	if !info.IsGroup {
		ev.ExternalContactID, ev.Phone = s.chatContact(ctx, info)
	}
	return s.adapter.emit(ev) == nil
}

// editedBody is the text or caption of the new content of an edit.
func editedBody(m *waE2E.Message) (string, bool) {
	switch {
	case m.GetConversation() != "":
		return m.GetConversation(), true
	case m.GetExtendedTextMessage() != nil:
		return m.GetExtendedTextMessage().GetText(), true
	case m.GetImageMessage() != nil:
		return m.GetImageMessage().GetCaption(), true
	case m.GetVideoMessage() != nil:
		return m.GetVideoMessage().GetCaption(), true
	case m.GetDocumentMessage() != nil:
		return m.GetDocumentMessage().GetCaption(), true
	}
	return "", false
}

// chatContact is the contact of a chat, as the ID and the phone of Message.
func (s *session) chatContact(ctx context.Context, info types.MessageInfo) (id, phone string) {
	contact := s.contact(ctx, info)
	if contact.Server == types.DefaultUserServer {
		phone = contact.User
	}
	return contact.String(), phone
}

// translate converts a Whatsmeow message into the neutral type, downloading
// its media. Edits and deletions have their own events; other protocol
// messages (settings, key sharing) are skipped; other unknown kinds become
// unsupported (reactions have their own event), so they still show up in the history.
func (s *session) translate(ctx context.Context, evt *events.Message) (messaging.Message, bool) {
	info := evt.Info
	m := evt.Message
	if m == nil || evt.IsEdit || m.GetProtocolMessage() != nil || info.Chat == types.StatusBroadcastJID {
		return messaging.Message{}, false
	}

	msg := messaging.Message{
		ExternalMessageID: info.ID,
		Group:             info.IsGroup,
		SentAt:            info.Timestamp,
	}
	if info.IsGroup {
		// Groups are ignored by the pilot: no contact and no download.
		return msg, true
	}

	contact := s.contact(ctx, info)
	msg.ExternalContactID = contact.String()
	if contact.Server == types.DefaultUserServer {
		msg.Phone = contact.User
	}
	if !info.IsFromMe {
		msg.ContactName = info.PushName
	}

	switch {
	case m.GetConversation() != "":
		msg.Type, msg.Body = messaging.TypeText, m.GetConversation()
	case m.GetExtendedTextMessage() != nil:
		msg.Type, msg.Body = messaging.TypeText, m.GetExtendedTextMessage().GetText()
	case m.GetImageMessage() != nil:
		img := m.GetImageMessage()
		msg.Type, msg.Body = messaging.TypeImage, img.GetCaption()
		s.attach(ctx, &msg, img, img.GetMimetype(), "", 0)
	case m.GetVideoMessage() != nil:
		video := m.GetVideoMessage()
		msg.Type, msg.Body = messaging.TypeVideo, video.GetCaption()
		s.attach(ctx, &msg, video, video.GetMimetype(), "", video.GetSeconds())
	case m.GetAudioMessage() != nil:
		audio := m.GetAudioMessage()
		msg.Type = messaging.TypeAudio
		s.attach(ctx, &msg, audio, audio.GetMimetype(), "", audio.GetSeconds())
	case m.GetDocumentMessage() != nil:
		doc := m.GetDocumentMessage()
		msg.Type, msg.Body = messaging.TypeDocument, doc.GetCaption()
		s.attach(ctx, &msg, doc, doc.GetMimetype(), doc.GetFileName(), 0)
	default:
		msg.Type = messaging.TypeUnsupported
	}
	msg.Quote = quote(m)
	return msg, true
}

// quote reads the message a reply cites, from the context of a text or media
// message. Without the ID of the quoted message there is no quote; without its
// content there is no snippet. The quoted media is not downloaded.
func quote(m *waE2E.Message) *messaging.Quote {
	// A message carries one content; the getters are nil-safe, so the absent
	// kinds return no context.
	var info *waE2E.ContextInfo
	for _, c := range []interface{ GetContextInfo() *waE2E.ContextInfo }{
		m.GetExtendedTextMessage(), m.GetImageMessage(), m.GetVideoMessage(),
		m.GetAudioMessage(), m.GetDocumentMessage(),
	} {
		if info = c.GetContextInfo(); info != nil {
			break
		}
	}
	if info.GetStanzaID() == "" {
		return nil
	}
	q := &messaging.Quote{ExternalMessageID: info.GetStanzaID()}
	if quoted := info.GetQuotedMessage(); quoted != nil {
		q.Snippet = snippet(quoted)
	}
	return q
}

// snippet tells the type and the text of a quoted message: the text, the
// caption of an image or video, or the name of a document (its caption when it
// has no name). Other kinds are unsupported, without text.
func snippet(m *waE2E.Message) *messaging.QuoteSnippet {
	switch {
	case m.GetConversation() != "":
		return &messaging.QuoteSnippet{Type: messaging.TypeText, Text: m.GetConversation()}
	case m.GetExtendedTextMessage() != nil:
		return &messaging.QuoteSnippet{Type: messaging.TypeText, Text: m.GetExtendedTextMessage().GetText()}
	case m.GetImageMessage() != nil:
		return &messaging.QuoteSnippet{Type: messaging.TypeImage, Text: m.GetImageMessage().GetCaption()}
	case m.GetVideoMessage() != nil:
		return &messaging.QuoteSnippet{Type: messaging.TypeVideo, Text: m.GetVideoMessage().GetCaption()}
	case m.GetAudioMessage() != nil:
		return &messaging.QuoteSnippet{Type: messaging.TypeAudio}
	case m.GetDocumentMessage() != nil:
		doc := m.GetDocumentMessage()
		name := doc.GetFileName()
		if name == "" {
			name = doc.GetCaption()
		}
		return &messaging.QuoteSnippet{Type: messaging.TypeDocument, Text: name}
	default:
		return &messaging.QuoteSnippet{Type: messaging.TypeUnsupported}
	}
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

// attach downloads the file of the message. A file that cannot be had turns
// the message into media_unavailable, so it enters the ticket as a notice
// instead of being delivered again forever.
func (s *session) attach(ctx context.Context, msg *messaging.Message, file downloadable, mimeType, fileName string, seconds uint32) {
	data, err := s.download(ctx, file)
	if err != nil {
		s.adapter.logger.Warn("whatsapp media unavailable", "sector_id", s.sectorID, "message_id", msg.ExternalMessageID, "error", err)
		msg.Type = messaging.TypeMediaUnavailable
		if msg.Body == "" {
			msg.Body = fileName
		}
		return
	}
	msg.Media = &messaging.Media{Data: data, MimeType: mimeType, FileName: fileName, DurationSeconds: int(seconds)}
}

// download checks the reported size before fetching the file and tries a few
// times. Each attempt has its own timeout, longer than the one of the event:
// a large file on a slow link is not a reason to give up on it.
func (s *session) download(ctx context.Context, file downloadable) ([]byte, error) {
	if size := file.GetFileLength(); size > messaging.MaxReceivedFileSize {
		return nil, fmt.Errorf("reported size %d is above the limit", size)
	}
	var err error
	for attempt := range downloadAttempts {
		if attempt > 0 {
			time.Sleep(downloadRetryDelay)
		}
		var data []byte
		data, err = s.downloadOnce(ctx, file)
		if err != nil {
			continue
		}
		// The reported size comes from the sender and may be wrong.
		if len(data) > messaging.MaxReceivedFileSize {
			return nil, fmt.Errorf("downloaded size %d is above the limit", len(data))
		}
		return data, nil
	}
	return nil, fmt.Errorf("download media: %w", err)
}

func (s *session) downloadOnce(ctx context.Context, file downloadable) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), downloadTimeout)
	defer cancel()
	return s.client.Download(ctx, file)
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
	return a.send(ctx, msg.SectorID, msg.To, msg.IdempotencyKey, func(_ context.Context, cli *whatsmeow.Client, to types.JID) (*waE2E.Message, error) {
		if msg.Quote == nil {
			return &waE2E.Message{Conversation: proto.String(msg.Body)}, nil
		}
		// A reply carries its context, which a plain conversation has not.
		return &waE2E.Message{ExtendedTextMessage: &waE2E.ExtendedTextMessage{
			Text: proto.String(msg.Body), ContextInfo: replyContext(cli, to, msg.Quote),
		}}, nil
	})
}

// replyContext is the context that makes a message a reply: the ID of the
// quoted message, its author (the contact, or the sector number itself) and
// its snippet, which WhatsApp shows in the bubble of the quote.
func replyContext(cli *whatsmeow.Client, to types.JID, q *messaging.Quote) *waE2E.ContextInfo {
	if q == nil {
		return nil
	}
	author := to.ToNonAD()
	if q.FromSector {
		author = cli.Store.GetJID().ToNonAD()
	}
	return &waE2E.ContextInfo{
		StanzaID:      proto.String(q.ExternalMessageID),
		Participant:   proto.String(author.String()),
		QuotedMessage: quotedMessage(q.Snippet),
	}
}

// quotedMessage rebuilds the quoted content from the snippet, without its
// media; the reverse of snippet. Without a snippet, the text is empty.
func quotedMessage(sn *messaging.QuoteSnippet) *waE2E.Message {
	if sn == nil {
		return &waE2E.Message{Conversation: proto.String("")}
	}
	text := optional(sn.Text)
	switch sn.Type {
	case messaging.TypeImage:
		return &waE2E.Message{ImageMessage: &waE2E.ImageMessage{Caption: text}}
	case messaging.TypeVideo:
		return &waE2E.Message{VideoMessage: &waE2E.VideoMessage{Caption: text}}
	case messaging.TypeAudio:
		return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{PTT: proto.Bool(true)}}
	case messaging.TypeDocument:
		return &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{FileName: text, Title: text}}
	default:
		// Text, and a file that could not be downloaded, whose original kind
		// is unknown: its caption or name goes as text.
		return &waE2E.Message{Conversation: proto.String(sn.Text)}
	}
}

// SendMedia uploads the attachment to WhatsApp and sends it.
func (a *Adapter) SendMedia(ctx context.Context, msg messaging.MediaMessage) (string, error) {
	return a.send(ctx, msg.SectorID, msg.To, msg.IdempotencyKey, func(ctx context.Context, cli *whatsmeow.Client, to types.JID) (*waE2E.Message, error) {
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
		reply := replyContext(cli, to, msg.Quote)
		switch msg.Type {
		case messaging.TypeImage:
			return &waE2E.Message{ImageMessage: &waE2E.ImageMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption, ContextInfo: reply,
			}}, nil
		case messaging.TypeVideo:
			return &waE2E.Message{VideoMessage: &waE2E.VideoMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption, Seconds: seconds, ContextInfo: reply,
			}}, nil
		case messaging.TypeAudio:
			// Voice note: WhatsApp plays OGG/Opus with PTT set.
			return &waE2E.Message{AudioMessage: &waE2E.AudioMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Seconds: seconds, PTT: proto.Bool(true), ContextInfo: reply,
			}}, nil
		default:
			return &waE2E.Message{DocumentMessage: &waE2E.DocumentMessage{
				URL: &up.URL, DirectPath: &up.DirectPath, MediaKey: up.MediaKey, FileEncSHA256: up.FileEncSHA256,
				FileSHA256: up.FileSHA256, FileLength: length, Mimetype: mime, Caption: caption,
				FileName: optional(msg.Media.FileName), Title: optional(msg.Media.FileName), ContextInfo: reply,
			}}, nil
		}
	})
}

// SendReaction sends the reaction of the sector number, an empty text being
// the removal. WhatsApp finds the target by its ID, the chat and whether the
// sector sent it; any refusal comes back as the neutral error.
func (a *Adapter) SendReaction(ctx context.Context, r messaging.Reaction) error {
	cli, err := a.client(r.SectorID)
	if err != nil {
		return err
	}
	chat, err := types.ParseJID(r.To)
	if err != nil {
		return fmt.Errorf("%w: parse recipient %q: %w", messaging.ErrNotAccepted, r.To, err)
	}
	// The author of a received target is the contact; an empty one is the
	// sector number itself.
	sender := chat
	if r.TargetFromSector {
		sender = types.EmptyJID
	}
	msg := cli.BuildReaction(chat, sender, r.TargetExternalMessageID, r.Emoji)
	if _, err := cli.SendMessage(ctx, chat, msg); err != nil {
		return fmt.Errorf("%w: send reaction: %w", messaging.ErrNotAccepted, err)
	}
	return nil
}

func (a *Adapter) send(ctx context.Context, sectorID int64, to, key string, build func(context.Context, *whatsmeow.Client, types.JID) (*waE2E.Message, error)) (string, error) {
	cli, err := a.client(sectorID)
	if err != nil {
		return "", err
	}
	jid, err := types.ParseJID(to)
	if err != nil {
		return "", fmt.Errorf("parse recipient %q: %w", to, err)
	}
	msg, err := build(ctx, cli, jid)
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
