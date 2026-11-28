package helpdesk

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// HandleEvent routes the events of the messaging provider.
func (s *Service) HandleEvent(ctx context.Context, ev messaging.Event) error {
	switch ev := ev.(type) {
	case messaging.ConnectionChanged:
		return s.HandleConnection(ctx, ev)
	case messaging.MessageReceived:
		return s.HandleReceived(ctx, ev)
	case messaging.MessageSentOutside:
		return s.HandleSentOutside(ctx, ev)
	case messaging.StatusUpdated:
		return s.HandleStatus(ctx, ev)
	case messaging.ReactionReceived:
		return s.HandleReaction(ctx, ev)
	case messaging.MessageEdited:
		return s.HandleMessageEdited(ctx, ev)
	case messaging.MessageRevoked:
		return s.HandleMessageRevoked(ctx, ev)
	}
	return nil
}

// Name of a contact known only by LID, without phone nor profile name.
const unnamedContact = "Contato sem telefone"

// Limits of the card of a link, applied when the message is recorded
// (spec #511): the texts are cut without splitting a character, and a
// thumbnail above the limit leaves the card without image.
const (
	maxPreviewTitleLength       = 200
	maxPreviewDescriptionLength = 500
	maxPreviewThumbnailBytes    = 64 << 10
	previewThumbnailMimeType    = "image/jpeg"
)

// normalizePreview cuts the card to its limits and drops it when it has no
// title or no address the panel may open as a link (http or https), as a
// message without a card. nil means the message shows only the text.
func normalizePreview(p *messaging.Preview) *messaging.Preview {
	title := cutRunes(strings.TrimSpace(p.Title), maxPreviewTitleLength)
	url := strings.TrimSpace(p.URL)
	if title == "" || !messaging.IsLinkAddress(url) {
		return nil
	}
	preview := &messaging.Preview{
		URL:         url,
		Title:       title,
		Description: cutRunes(strings.TrimSpace(p.Description), maxPreviewDescriptionLength),
	}
	if len(p.Thumbnail) <= maxPreviewThumbnailBytes {
		preview.Thumbnail = p.Thumbnail
	}
	return preview
}

// cutRunes cuts a text at max characters, never splitting a character.
func cutRunes(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}

// Protocol years and the day of the closed tickets follow the office clock, not UTC.

var protocolZone = mustLoadLocation("America/Sao_Paulo")

var phonePattern = regexp.MustCompile(`^[0-9]{10,15}$`)

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// HandleReceived records a message sent by a contact to the sector number.
func (s *Service) HandleReceived(ctx context.Context, ev messaging.MessageReceived) error {
	return s.record(ctx, ev.SectorID, ev.Message, db.MessageOriginCustomer)
}

// HandleSentOutside records a message sent from the phone of the sector,
// outside the system, with no agent as author.
func (s *Service) HandleSentOutside(ctx context.Context, ev messaging.MessageSentOutside) error {
	return s.record(ctx, ev.SectorID, ev.Message, db.MessageOriginPhone)
}

// record adds a message from the provider to the open ticket of the contact
// in the sector, opening a queued ticket when there is none. Group messages
// are ignored, and a message already recorded (same external ID in the
// sector) has no effect, so the provider may deliver it again. The panels
// of the sector are notified after the commit.
func (s *Service) record(ctx context.Context, sectorID int64, msg messaging.Message, origin db.MessageOrigin) error {
	if msg.Group {
		return nil
	}
	if msg.ExternalMessageID == "" {
		return errors.New("message without external id")
	}
	exists, err := s.q.MessageExists(ctx, db.MessageExistsParams{SectorID: sectorID, ExternalMessageID: &msg.ExternalMessageID})
	if err != nil {
		return fmt.Errorf("check message: %w", err)
	}
	if exists {
		return nil
	}

	sentAt := msg.SentAt
	if sentAt.IsZero() {
		sentAt = time.Now()
	}

	var cards []byte
	if msg.Type == messaging.TypeContact {
		var ok bool
		if cards, ok, err = encodeContactCards(msg.ContactCards); err != nil {
			return err
		}
		if !ok {
			msg.Type = messaging.TypeUnsupported
		}
	}

	// The card of a link is written only with a message received from the
	// contact, within the limits of the spec (#511).
	var preview *messaging.Preview
	if origin == db.MessageOriginCustomer && msg.Preview != nil {
		preview = normalizePreview(msg.Preview)
	}

	// The file is saved before the message is committed (docs/data-model.md). If
	// the transaction fails or loses to a concurrent delivery, the file is
	// left without a message.
	media, err := s.saveMedia(ctx, msg, sentAt)
	if err != nil {
		return err
	}

	// The thumbnail of the card is a media file like the others, saved before
	// the message is committed. A card without image is better than a message
	// lost over the picture: a failure in the storage leaves it out.
	var thumbnail *db.CreateMediaFileParams
	if preview != nil && len(preview.Thumbnail) > 0 {
		file, err := s.storeMedia(ctx, messaging.Media{Data: preview.Thumbnail, MimeType: previewThumbnailMimeType}, sentAt)
		if err != nil {
			slog.Warn("store link preview thumbnail", "external_message_id", msg.ExternalMessageID, "error", err)
			preview.Thumbnail = nil
		} else {
			thumbnail = file
		}
	}

	var ticketID int64
	var contactID int64
	var opened bool
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		// Before any other lock, in the order of the changes received for
		// this message, so one that arrives meanwhile is never left unlinked.
		if err := q.LockMessageExternalID(ctx, db.LockMessageExternalIDParams{SectorID: sectorID, ExternalMessageID: msg.ExternalMessageID}); err != nil {
			return fmt.Errorf("lock message: %w", err)
		}
		contact, link, err := findOrCreateContact(ctx, q, msg)
		if err != nil {
			return err
		}
		ticket, first, err := openTicket(ctx, q, sectorID, contact, sentAt)
		if err != nil {
			return err
		}
		contactID = contact.ID
		opened = first
		ticketID = ticket.ID
		// The contact is written only after the ticket is locked, in the
		// order of the closing (ticket, then contact), so the two never wait
		// on each other.
		if link {
			if err := q.SetContactExternalID(ctx, db.SetContactExternalIDParams{ID: contact.ID, ExternalContactID: &msg.ExternalContactID}); err != nil {
				return fmt.Errorf("set contact external id: %w", err)
			}
		}
		// After the contact is written, so saving its registration, which
		// writes the contact and then the links, never waits on this link
		// while this transaction waits on the contact.
		if err := directory.LinkSector(ctx, q, contact.ID, sectorID, nil); err != nil {
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

		var previewMediaID *int64
		if thumbnail != nil {
			m, err := q.CreateMediaFile(ctx, *thumbnail)
			if err != nil {
				return fmt.Errorf("create preview media file: %w", err)
			}
			previewMediaID = &m.ID
		}

		params := db.CreateProviderMessageParams{
			TicketID:          ticket.ID,
			SectorID:          sectorID,
			ContactID:         contact.ID,
			Direction:         db.MessageDirectionInbound,
			Origin:            origin,
			Type:              db.MessageType(msg.Type),
			Body:              optional(msg.Body),
			MediaID:           mediaID,
			ExternalMessageID: &msg.ExternalMessageID,
			SentAt:            sentAt,
			ContactCards:      cards,
		}
		if preview != nil {
			params.PreviewUrl = &preview.URL
			params.PreviewTitle = &preview.Title
			params.PreviewDescription = optional(preview.Description)
			params.PreviewMediaID = previewMediaID
		}
		if err := setQuote(ctx, q, &params, msg.Quote); err != nil {
			return err
		}
		if origin == db.MessageOriginPhone {
			params.Direction = db.MessageDirectionOutbound
			params.Status = db.NullMessageStatus{MessageStatus: db.MessageStatusSent, Valid: true}
		}
		created, err := q.CreateProviderMessage(ctx, params)
		if errors.Is(err, pgx.ErrNoRows) {
			return errDuplicate
		}
		if err != nil {
			return fmt.Errorf("create message: %w", err)
		}
		contactExternalID := contact.ExternalContactID
		if link {
			contactExternalID = &msg.ExternalContactID
		}
		_, err = linkPendingChanges(ctx, q, sectorID, &db.GetMessageForChangeRow{
			ID: created.ID, TicketID: created.TicketID, Origin: created.Origin, Body: created.Body,
			ContactExternalID: contactExternalID, ContactPhone: contact.Phone,
		}, msg.ExternalMessageID)
		return err
	})
	if errors.Is(err, errDuplicate) {
		return nil
	}
	if err != nil {
		return err
	}
	s.hub.Publish(realtime.TicketChanged(sectorID, ticketID))
	// The picture of the contact comes after the ticket opened by a received
	// message, in the background (spec #482): it never delays the message nor
	// fails the event.
	if opened && origin == db.MessageOriginCustomer {
		s.refreshContactPhoto(sectorID, contactID)
	}
	return nil
}

// setQuote records the quote of the message, when the provider identified
// one. It links to the quoted message only when it is in the same ticket,
// already locked by the caller: a message of another ticket, even of the same
// contact, is never linked, so the quote cannot show its content. The snippet
// is the one the provider delivered, if any.
func setQuote(ctx context.Context, q *db.Queries, params *db.CreateProviderMessageParams, quote *messaging.Quote) error {
	if quote == nil || quote.ExternalMessageID == "" {
		return nil
	}
	params.QuotedExternalMessageID = &quote.ExternalMessageID
	id, err := q.FindTicketMessageID(ctx, db.FindTicketMessageIDParams{
		SectorID:          params.SectorID,
		ExternalMessageID: &quote.ExternalMessageID,
		TicketID:          params.TicketID,
	})
	switch {
	case err == nil:
		params.QuotedMessageID = &id
	case !errors.Is(err, pgx.ErrNoRows):
		return fmt.Errorf("find quoted message: %w", err)
	}
	if quote.Snippet != nil {
		t := db.MessageType(quote.Snippet.Type)
		if !t.Valid() {
			t = db.MessageTypeUnsupported
		}
		params.QuotedType = db.NullMessageType{MessageType: t, Valid: true}
		params.QuotedBody = optional(quote.Snippet.Text)
	}
	return nil
}

// saveMedia writes the attachment to the storage and returns its record.
func (s *Service) saveMedia(ctx context.Context, msg messaging.Message, now time.Time) (*db.CreateMediaFileParams, error) {
	if !db.MessageType(msg.Type).Valid() {
		return nil, fmt.Errorf("unknown message type %q", msg.Type)
	}
	switch msg.Type {
	case messaging.TypeImage, messaging.TypeVideo, messaging.TypeAudio, messaging.TypeDocument, messaging.TypeSticker:
	default:
		return nil, nil
	}
	if msg.Media == nil {
		return nil, fmt.Errorf("%s message without media", msg.Type)
	}

	return s.storeMedia(ctx, *msg.Media, now)
}

// storeMedia writes a file to the storage and returns its record, to be
// created in the transaction of the message.
func (s *Service) storeMedia(ctx context.Context, media messaging.Media, now time.Time) (*db.CreateMediaFileParams, error) {
	key := storage.NewKey(now)
	if err := s.storage.Put(ctx, key, media.Data); err != nil {
		return nil, fmt.Errorf("save media: %w", err)
	}
	sum := sha256.Sum256(media.Data)
	mimeType := media.MimeType
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	m := &db.CreateMediaFileParams{
		StorageKey: key,
		MimeType:   mimeType,
		SizeBytes:  int64(len(media.Data)),
		FileName:   optional(media.FileName),
		Sha256:     hex.EncodeToString(sum[:]),
	}
	if media.DurationSeconds > 0 {
		seconds := int32(min(media.DurationSeconds, 1<<31-1))
		m.DurationSeconds = &seconds
	}
	return m, nil
}

// findOrCreateContact matches the message to a contact by the provider
// contact ID, then by phone, with or without the Brazilian ninth digit; a
// contact registered before its first message keeps the ID from then on, and
// link tells the caller to record it. Otherwise an unregistered contact is
// created.
func findOrCreateContact(ctx context.Context, q *db.Queries, msg messaging.Message) (contact db.Contact, link bool, err error) {
	if msg.ExternalContactID == "" {
		return db.Contact{}, false, errors.New("message without external contact id")
	}
	phone := ""
	if phonePattern.MatchString(msg.Phone) {
		phone = msg.Phone
	}

	for attempt := 0; attempt < 2; attempt++ {
		contact, err = q.GetContactByExternalID(ctx, &msg.ExternalContactID)
		if err == nil {
			return contact, false, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.Contact{}, false, fmt.Errorf("get contact by external id: %w", err)
		}

		if phone != "" {
			if err := directory.LockPhone(ctx, q, phone); err != nil {
				return db.Contact{}, false, err
			}
			contact, err = q.GetContactByPhone(ctx, directory.PhoneVariants(phone))
			if err == nil {
				// A contact known by another provider ID (such as its LID) keeps it.
				return contact, contact.ExternalContactID == nil, nil
			}
			if !errors.Is(err, pgx.ErrNoRows) {
				return db.Contact{}, false, fmt.Errorf("get contact by phone: %w", err)
			}
		}

		name := msg.ContactName
		switch {
		case name != "":
		case phone != "":
			name = phone
		default:
			name = unnamedContact
		}
		contact, err = q.CreateUnregisteredContact(ctx, db.CreateUnregisteredContactParams{
			Name:              name,
			Phone:             optional(phone),
			ExternalContactID: &msg.ExternalContactID,
		})
		if err == nil {
			return contact, false, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.Contact{}, false, fmt.Errorf("create contact: %w", err)
		}
		// A concurrent message created the contact first; look it up again.
	}
	return db.Contact{}, false, fmt.Errorf("contact %s could not be matched", msg.ExternalContactID)
}

// openTicket locks the open ticket of the contact in the sector, or opens a
// queued one with the next protocol. The row lock keeps the message from
// entering a ticket that is being closed or transferred. created tells the
// caller the ticket is new, for the work that runs once per ticket.
func openTicket(ctx context.Context, q *db.Queries, sectorID int64, contact db.Contact, arrivedAt time.Time) (ticket db.Ticket, created bool, err error) {
	ticket, err = db.AsTicket(q.GetOpenTicketForUpdate(ctx, db.GetOpenTicketForUpdateParams{SectorID: sectorID, ContactID: contact.ID}))
	if err == nil {
		return ticket, false, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, false, fmt.Errorf("get open ticket: %w", err)
	}

	protocol, err := nextProtocol(ctx, q)
	if err != nil {
		return db.Ticket{}, false, err
	}
	ticket, err = db.AsTicket(q.CreateQueuedTicket(ctx, db.CreateQueuedTicketParams{
		Protocol:       protocol,
		SectorID:       sectorID,
		ContactID:      contact.ID,
		OrganizationID: contact.OrganizationID,
		ArrivedAt:      arrivedAt,
	}))
	if err == nil {
		return ticket, true, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, false, fmt.Errorf("create ticket: %w", err)
	}
	// A concurrent message opened the ticket first and committed.
	ticket, err = db.AsTicket(q.GetOpenTicketForUpdate(ctx, db.GetOpenTicketForUpdateParams{SectorID: sectorID, ContactID: contact.ID}))
	if err != nil {
		return db.Ticket{}, false, fmt.Errorf("get open ticket: %w", err)
	}
	return ticket, false, nil
}

// nextProtocol takes the next protocol of the year, locking the counter
// until the transaction that creates the ticket ends.
func nextProtocol(ctx context.Context, q *db.Queries) (string, error) {
	year := time.Now().In(protocolZone).Year()
	n, err := q.NextProtocolNumber(ctx, int32(year))
	if err != nil {
		return "", fmt.Errorf("next protocol: %w", err)
	}
	return fmt.Sprintf("%04d-%06d", year, n), nil
}
