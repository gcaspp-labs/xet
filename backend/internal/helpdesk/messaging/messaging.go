// Package messaging defines the contract between the service and a WhatsApp
// provider. Providers live in subpackages (whatsmeow, later cloudapi) and are
// the only code that imports provider libraries; the rest of the system sees
// only the neutral types below (docs/architecture.md).
//
// This package knows no other domain: providers emit events and the
// application decides what to do with them.
package messaging

import (
	"context"
	"errors"
	"time"
)

var (
	// ErrNotConnected means the sector has no active session with the provider.
	ErrNotConnected = errors.New("sector not connected")
	// ErrContactNotFound means the phone has no account in the provider.
	ErrContactNotFound = errors.New("contact not found in provider")
)

// ConnectionStatus mirrors the connection_status enum of sectors.
type ConnectionStatus string

const (
	StatusDisconnected ConnectionStatus = "disconnected"
	StatusConnecting   ConnectionStatus = "connecting"
	StatusConnected    ConnectionStatus = "connected"
	// StatusLoggedOut means the account was unlinked and needs a new pairing.
	StatusLoggedOut ConnectionStatus = "logged_out"
)

// MessageType mirrors the message_type enum of messages.
type MessageType string

const (
	TypeText     MessageType = "text"
	TypeImage    MessageType = "image"
	TypeVideo    MessageType = "video"
	TypeAudio    MessageType = "audio"
	TypeDocument MessageType = "document"
	// TypeUnsupported covers stickers, reactions, locations and other types
	// outside the pilot, kept as a notice in the history.
	TypeUnsupported MessageType = "unsupported"
	// TypeMediaUnavailable is a received file above MaxReceivedFileSize or that
	// did not download, delivered without content. Body holds the caption or
	// the file name.
	TypeMediaUnavailable MessageType = "media_unavailable"
)

// MaxReceivedFileSize is the limit of a received file (spec.md, Conversa).
const MaxReceivedFileSize = 100 << 20

// DeliveryStatus is the delivery progress of a sent message.
type DeliveryStatus string

const (
	DeliverySent      DeliveryStatus = "sent"
	DeliveryDelivered DeliveryStatus = "delivered"
	DeliveryRead      DeliveryStatus = "read"
	DeliveryFailed    DeliveryStatus = "failed"
)

// Media is the content of an attachment, already downloaded from the provider.
type Media struct {
	Data            []byte
	MimeType        string
	FileName        string
	DurationSeconds int
}

// Message is a message that passed through the sector number.
type Message struct {
	ExternalMessageID string
	// ExternalContactID identifies the contact in the provider; incoming
	// messages are matched to contacts by it, not by the phone text.
	ExternalContactID string
	// Phone holds the contact digits with country code, when the provider knows them.
	Phone string
	// ContactName is the profile name of the contact, when known.
	ContactName string
	// Group reports a group chat or broadcast list.
	Group  bool
	Type   MessageType
	Body   string
	Media  *Media
	SentAt time.Time
}

// Event is something that happened in a sector session.
type Event interface {
	Sector() int64
}

// ConnectionChanged reports a new connection status of the sector number.
// Providers paired by QR code report each new code as connecting again.
type ConnectionChanged struct {
	SectorID int64
	Status   ConnectionStatus
	// AccountID identifies the linked account in the provider; set when connected.
	AccountID string
	// Phone holds the digits of the linked account with country code; set when connected.
	Phone string
}

// MessageReceived is a message sent by a contact to the sector number.
type MessageReceived struct {
	SectorID int64
	Message  Message
}

// MessageSentOutside is a message sent by the sector number outside the
// system, such as from the phone itself.
type MessageSentOutside struct {
	SectorID int64
	Message  Message
}

// StatusUpdated reports the delivery progress of messages sent by the sector.
type StatusUpdated struct {
	SectorID           int64
	ExternalMessageIDs []string
	Status             DeliveryStatus
	At                 time.Time
}

func (e ConnectionChanged) Sector() int64  { return e.SectorID }
func (e MessageReceived) Sector() int64    { return e.SectorID }
func (e MessageSentOutside) Sector() int64 { return e.SectorID }
func (e StatusUpdated) Sector() int64      { return e.SectorID }

// EventHandler receives the events of every sector. A returned error tells
// the provider the event was not processed, so it may be delivered again.
type EventHandler func(ctx context.Context, ev Event) error

// Account is the sector session to start. An empty AccountID starts a new link.
type Account struct {
	SectorID  int64
	AccountID string
}

// TextMessage is a text to send. IdempotencyKey makes a retry reuse the same
// provider message instead of sending twice.
type TextMessage struct {
	SectorID       int64
	To             string
	Body           string
	IdempotencyKey string
}

// MediaMessage is an attachment to send, with an optional caption.
type MediaMessage struct {
	SectorID       int64
	To             string
	Type           MessageType
	Media          Media
	Caption        string
	IdempotencyKey string
}

// Provider is the contract every messaging provider implements.
type Provider interface {
	// Connect starts the session of the sector. It returns once the session
	// is connecting; the result arrives as ConnectionChanged events.
	Connect(ctx context.Context, account Account) error
	// Disconnect ends the session of the sector and unlinks its account. An
	// error means the device could not be told; the session is ended anyway.
	Disconnect(ctx context.Context, sectorID int64) error
	// Status reports the current connection of the sector.
	Status(sectorID int64) ConnectionStatus
	// SendText sends a text and returns the provider message ID.
	SendText(ctx context.Context, msg TextMessage) (string, error)
	// SendMedia sends an attachment and returns the provider message ID.
	SendMedia(ctx context.Context, msg MediaMessage) (string, error)
	// ResolveContact returns the provider contact ID of a phone with country code.
	ResolveContact(ctx context.Context, sectorID int64, phone string) (string, error)
}

// QRPairing is implemented by providers linked by QR code (Whatsmeow). It is
// not part of the common contract: the official API has no QR code.
type QRPairing interface {
	// QRCode returns the code to show while the sector is pairing.
	QRCode(sectorID int64) (string, bool)
}

// SavedContact is an entry of the address book of the sector number.
type SavedContact struct {
	// Name is the name saved on the phone, not the profile name.
	Name string
	// Phone holds the digits with country code.
	Phone string
}

// ContactBook is implemented by providers that can read the address book of
// the number (Whatsmeow). It is not part of the common contract: the official
// API may not offer it.
type ContactBook interface {
	// SavedContacts returns the address book of the sector number.
	SavedContacts(ctx context.Context, sectorID int64) ([]SavedContact, error)
}
