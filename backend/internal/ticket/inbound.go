// Package ticket manages the life cycle of the tickets: the queue of each
// sector, the assignee, transfers, closing and corrections.
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
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/storage"
)

// Name of a contact known only by LID, without phone nor profile name.
const unnamedContact = "Contato sem telefone"

// Protocol years follow the office clock, not UTC.
var protocolZone = mustLoadLocation("America/Sao_Paulo")

var phonePattern = regexp.MustCompile(`^[0-9]{10,15}$`)

// errDuplicate rolls back a message that a concurrent delivery recorded first.
var errDuplicate = errors.New("message already recorded")

type Service struct {
	pool    *pgxpool.Pool
	q       *db.Queries
	storage storage.Storage
	hub     *realtime.Hub
}

func NewService(pool *pgxpool.Pool, files storage.Storage, hub *realtime.Hub) *Service {
	return &Service{pool: pool, q: db.New(pool), storage: files, hub: hub}
}

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
		contact, err := findOrCreateContact(ctx, q, msg)
		if err != nil {
			return err
		}
		ticket, err := openTicket(ctx, q, sectorID, contact, sentAt)
		if err != nil {
			return err
		}
		ticketID = ticket.ID

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

	key := storage.NewKey(now)
	if err := s.storage.Put(ctx, key, msg.Media.Data); err != nil {
		return nil, fmt.Errorf("save media: %w", err)
	}
	sum := sha256.Sum256(msg.Media.Data)
	mimeType := msg.Media.MimeType
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	m := &db.CreateMediaFileParams{
		StorageKey: key,
		MimeType:   mimeType,
		SizeBytes:  int64(len(msg.Media.Data)),
		FileName:   optional(msg.Media.FileName),
		Sha256:     hex.EncodeToString(sum[:]),
	}
	if msg.Media.DurationSeconds > 0 {
		seconds := int32(min(msg.Media.DurationSeconds, 1<<31-1))
		m.DurationSeconds = &seconds
	}
	return m, nil
}

// findOrCreateContact matches the message to a contact by the provider
// contact ID, then by phone, with or without the Brazilian ninth digit; a
// contact registered before its first message keeps the ID from then on.
// Otherwise an unregistered contact is created.
func findOrCreateContact(ctx context.Context, q *db.Queries, msg messaging.Message) (db.Contact, error) {
	if msg.ExternalContactID == "" {
		return db.Contact{}, errors.New("message without external contact id")
	}
	phone := ""
	if phonePattern.MatchString(msg.Phone) {
		phone = msg.Phone
	}

	for attempt := 0; attempt < 2; attempt++ {
		contact, err := q.GetContactByExternalID(ctx, &msg.ExternalContactID)
		if err == nil {
			return contact, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.Contact{}, fmt.Errorf("get contact by external id: %w", err)
		}

		if phone != "" {
			contact, err = q.GetContactByPhone(ctx, phoneVariants(phone))
			if err == nil && contact.ExternalContactID != nil {
				// Known by another provider ID (such as its LID): keep it.
				return contact, nil
			}
			if err == nil {
				if err := q.SetContactExternalID(ctx, db.SetContactExternalIDParams{ID: contact.ID, ExternalContactID: &msg.ExternalContactID}); err != nil {
					return db.Contact{}, fmt.Errorf("set contact external id: %w", err)
				}
				contact.ExternalContactID = &msg.ExternalContactID
				return contact, nil
			}
			if !errors.Is(err, pgx.ErrNoRows) {
				return db.Contact{}, fmt.Errorf("get contact by phone: %w", err)
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
			return contact, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return db.Contact{}, fmt.Errorf("create contact: %w", err)
		}
		// A concurrent message created the contact first; look it up again.
	}
	return db.Contact{}, fmt.Errorf("contact %s could not be matched", msg.ExternalContactID)
}

// phoneVariants returns the phone and, for a Brazilian mobile number, the
// same number with or without the ninth digit.
func phoneVariants(phone string) []string {
	variants := []string{phone}
	if len(phone) < 5 || phone[:2] != "55" {
		return variants
	}
	switch {
	case len(phone) == 13 && phone[4] == '9':
		variants = append(variants, phone[:4]+phone[5:])
	case len(phone) == 12 && phone[4] >= '6':
		variants = append(variants, phone[:4]+"9"+phone[4:])
	}
	return variants
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

	year := time.Now().In(protocolZone).Year()
	n, err := q.NextProtocolNumber(ctx, int32(year))
	if err != nil {
		return db.Ticket{}, fmt.Errorf("next protocol: %w", err)
	}
	ticket, err = q.CreateQueuedTicket(ctx, db.CreateQueuedTicketParams{
		Protocol:       fmt.Sprintf("%04d-%06d", year, n),
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

func optional(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
