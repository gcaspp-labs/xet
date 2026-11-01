package ticket

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/directory"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/storage"
)

// Name of a contact known only by LID, without phone nor profile name.
const unnamedContact = "Contato sem telefone"

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

	// The file is saved before the message is committed (modelo-dados.md). If
	// the transaction fails or loses to a concurrent delivery, the file is
	// left without a message.
	media, err := s.saveMedia(ctx, msg, sentAt)
	if err != nil {
		return err
	}

	var ticketID int64
	err = pgx.BeginFunc(ctx, s.pool, func(tx pgx.Tx) error {
		q := s.q.WithTx(tx)
		contact, link, err := findOrCreateContact(ctx, q, msg)
		if err != nil {
			return err
		}
		ticket, err := openTicket(ctx, q, sectorID, contact, sentAt)
		if err != nil {
			return err
		}
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
		}
		if origin == db.MessageOriginPhone {
			params.Direction = db.MessageDirectionOutbound
			params.Status = db.NullMessageStatus{MessageStatus: db.MessageStatusSent, Valid: true}
		}
		_, err = q.CreateProviderMessage(ctx, params)
		if errors.Is(err, pgx.ErrNoRows) {
			return errDuplicate
		}
		if err != nil {
			return fmt.Errorf("create message: %w", err)
		}
		return nil
	})
	if errors.Is(err, errDuplicate) {
		return nil
	}
	if err != nil {
		return err
	}
	s.hub.Publish(realtime.TicketChanged(sectorID, ticketID))
	return nil
}

// saveMedia writes the attachment to the storage and returns its record.
func (s *Service) saveMedia(ctx context.Context, msg messaging.Message, now time.Time) (*db.CreateMediaFileParams, error) {
	if !db.MessageType(msg.Type).Valid() {
		return nil, fmt.Errorf("unknown message type %q", msg.Type)
	}
	switch msg.Type {
	case messaging.TypeImage, messaging.TypeVideo, messaging.TypeAudio, messaging.TypeDocument:
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
// entering a ticket that is being closed or transferred.
func openTicket(ctx context.Context, q *db.Queries, sectorID int64, contact db.Contact, arrivedAt time.Time) (db.Ticket, error) {
	ticket, err := q.GetOpenTicketForUpdate(ctx, db.GetOpenTicketForUpdateParams{SectorID: sectorID, ContactID: contact.ID})
	if err == nil {
		return ticket, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, fmt.Errorf("get open ticket: %w", err)
	}

	protocol, err := nextProtocol(ctx, q)
	if err != nil {
		return db.Ticket{}, err
	}
	ticket, err = q.CreateQueuedTicket(ctx, db.CreateQueuedTicketParams{
		Protocol:       protocol,
		SectorID:       sectorID,
		ContactID:      contact.ID,
		OrganizationID: contact.OrganizationID,
		ArrivedAt:      arrivedAt,
	})
	if err == nil {
		return ticket, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return db.Ticket{}, fmt.Errorf("create ticket: %w", err)
	}
	// A concurrent message opened the ticket first and committed.
	ticket, err = q.GetOpenTicketForUpdate(ctx, db.GetOpenTicketForUpdateParams{SectorID: sectorID, ContactID: contact.ID})
	if err != nil {
		return db.Ticket{}, fmt.Errorf("get open ticket: %w", err)
	}
	return ticket, nil
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
