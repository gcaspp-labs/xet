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
	// ErrNotAccepted means the provider refused what was sent or could not
	// take it, whatever the reason the provider gives.
	ErrNotAccepted = errors.New("provider did not accept the message")
	// ErrUnsupported means the provider does not offer the action at all, as
	// a provider without edits (Capabilities with a zero window).
	ErrUnsupported = errors.New("provider does not support the action")
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
	// TypeContact is a contact card, or several sent at once, with the cards
	// in Message.ContactCards and no Body.
	TypeContact MessageType = "contact"
	// TypeSticker is a received sticker, downloaded as an image/webp file and
	// delivered without Body. Sending stickers is outside the pilot.
	TypeSticker MessageType = "sticker"
	// TypeUnsupported covers locations and other types outside the pilot, kept
	// as a notice in the history. Reactions are not messages: they arrive as
	// ReactionReceived.
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

// Preview is the card of a link, as the provider delivers it in a received
// text (spec #511). The system never opens the site: the title, the
// description and the thumbnail bytes are the ones of the message itself.
type Preview struct {
	// URL is the address of the card, always http or https.
	URL string
	// Title is the title of the page. Required: without it there is no card.
	Title string
	// Description is the summary of the page, when the provider sends one.
	Description string
	// Thumbnail is the JPEG image of the card, when the provider sends one.
	Thumbnail []byte
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
	// Quote is the message this one replies to. Optional: nil when there is
	// no quote or the provider could not identify it, and nothing may
	// require it.
	Quote *Quote
	// ContactCards are the cards of a TypeContact message, in the order they
	// came, at least one; empty in the other types.
	ContactCards []ContactCard
	// Preview is the card of a link of a received text, when the provider
	// sends one; nil otherwise, and always nil in a sent message.
	Preview *Preview
}

// ContactCard is a contact shared in a message, as it came: it has no link to
// the contacts of the system. It covers the vCard of WhatsApp Web (Whatsmeow:
// FN, each TEL with its waid, ORG) and the "contacts" message of the official
// API, whose card has name.formatted_name, phones[] with phone and wa_id, and
// org (https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/contacts-messages,
// https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/contacts/).
// No provider format (vCard or other) leaves the adapter.
type ContactCard struct {
	// Name is the name shown on the card. Required, never empty.
	Name string
	// Phones are the phones of the card, in order; may be empty.
	Phones []ContactPhone
	// Organization is the name of the organization of the contact. Optional.
	Organization string
}

// ContactPhone is a phone of a contact card.
type ContactPhone struct {
	// Phone holds only the digits, as the card has them (with country code
	// when the card has it).
	Phone string
	// WhatsAppID is the WhatsApp account of the phone (waid, wa_id), when the
	// provider tells it. Optional.
	WhatsAppID string
}

// ProfilePictureKind tells what a profile picture lookup found. The three
// results are explicit, so "unchanged" is never confused with "no picture".
type ProfilePictureKind string

const (
	// ProfilePictureFound means the contact has a picture to fetch.
	ProfilePictureFound ProfilePictureKind = "found"
	// ProfilePictureNone means the contact has no picture or hides it from the
	// sector number; it is not an error.
	ProfilePictureNone ProfilePictureKind = "none"
	// ProfilePictureUnchanged means the existingID sent is still the current
	// picture, so there is nothing to fetch.
	ProfilePictureUnchanged ProfilePictureKind = "unchanged"
)

// ProfilePicture is the current profile picture of a contact in the provider.
// The URLs expire (spec.md, Armazenamento), so the caller downloads the images
// right away and stores them.
type ProfilePicture struct {
	// Kind tells which of the three results this is.
	Kind ProfilePictureKind
	// ID is the provider identifier of the picture, which changes when the
	// picture changes. Set with ProfilePictureFound.
	ID string
	// ThumbnailURL and FullURL are the provider URLs of the small preview and
	// of the full image. Set with ProfilePictureFound.
	ThumbnailURL string
	FullURL      string
}

// Quote is the message a reply cites, in a received message or in one to
// send. It points at it only by its provider message ID, which every provider
// has; the rest is optional.
type Quote struct {
	// ExternalMessageID is the provider ID of the quoted message. Required.
	ExternalMessageID string
	// FromSector reports, when sending, a quoted message sent by the sector
	// number rather than received from the contact. Optional: providers whose
	// protocol needs the author of the quoted message use it (Whatsmeow),
	// others ignore it. Received messages leave it false.
	FromSector bool
	// Snippet is the quoted content to show. Optional: a provider that only
	// delivers the ID (such as the official API) leaves it nil.
	Snippet *QuoteSnippet
}

// QuoteSnippet is what the provider tells of the quoted content, without its
// media: the type and the text, the caption (image and video) or the file name
// (document, or its caption when it has no name), or the name of the first
// card (contact). Text may be empty, as in audio and stickers.
type QuoteSnippet struct {
	Type MessageType
	Text string
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

// ReactionReceived is a reaction to a message of a chat with a contact, made
// by the contact or from the phone of the sector. It points at the target only
// by its provider message ID, which every provider has. An empty Emoji removes
// the reaction.
type ReactionReceived struct {
	SectorID int64
	// TargetExternalMessageID is the provider ID of the message reacted to.
	TargetExternalMessageID string
	// ExternalContactID and Phone identify the contact of the chat, as in Message.
	ExternalContactID string
	Phone             string
	// Group reports a reaction in a group chat or broadcast list.
	Group bool
	// Emoji is the reaction; empty removes the one the author had set.
	Emoji string
	// FromSectorPhone reports a reaction made from the phone of the sector,
	// outside the system. Optional: a provider that cannot tell leaves it
	// false, and nothing may depend on it being set.
	FromSectorPhone bool
	At              time.Time
}

// MessageEdited is a new content of a message already sent, edited by the
// contact or from the phone of the sector (an echo of an edit made through the
// system arrives the same way). It points at the target only by its provider
// message ID, which every provider has; the edit is not a new message.
type MessageEdited struct {
	SectorID int64
	// ExternalEventID is the provider ID of the edit itself. Optional: a
	// provider that has none leaves it empty, and the edit is then matched by
	// its time and content. Delivered again, the same ID changes nothing.
	ExternalEventID string
	// TargetExternalMessageID is the provider ID of the edited message. Required.
	TargetExternalMessageID string
	// ExternalContactID and Phone identify the contact of the chat, as in Message.
	ExternalContactID string
	Phone             string
	// Group reports an edit in a group chat or broadcast list.
	Group bool
	// FromSector reports an edit made by the sector number (from the phone, or
	// the echo of one made through the system) rather than by the contact.
	FromSector bool
	// Body is the new text, or the new caption of an attachment; the file
	// does not change.
	Body string
	// At is when the edit was made, according to the provider.
	At time.Time
}

// MessageRevoked is a message deleted for everyone by the contact or from the
// phone of the sector. It points at the target only by its provider message
// ID. The content already known is kept by the system.
type MessageRevoked struct {
	SectorID int64
	// ExternalEventID is the provider ID of the deletion itself. Optional, as
	// in MessageEdited.
	ExternalEventID string
	// TargetExternalMessageID is the provider ID of the deleted message. Required.
	TargetExternalMessageID string
	// ExternalContactID and Phone identify the contact of the chat, as in Message.
	ExternalContactID string
	Phone             string
	// Group reports a deletion in a group chat or broadcast list.
	Group bool
	// FromSector reports a deletion made by the sector number rather than by
	// the contact.
	FromSector bool
	// At is when the message was deleted, according to the provider.
	At time.Time
}

func (e ConnectionChanged) Sector() int64  { return e.SectorID }
func (e MessageReceived) Sector() int64    { return e.SectorID }
func (e MessageSentOutside) Sector() int64 { return e.SectorID }
func (e StatusUpdated) Sector() int64      { return e.SectorID }
func (e ReactionReceived) Sector() int64   { return e.SectorID }
func (e MessageEdited) Sector() int64      { return e.SectorID }
func (e MessageRevoked) Sector() int64     { return e.SectorID }

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
	// Quote is the message this one replies to; nil when it quotes nothing.
	Quote *Quote
}

// MediaMessage is an attachment to send, with an optional caption.
type MediaMessage struct {
	SectorID       int64
	To             string
	Type           MessageType
	Media          Media
	Caption        string
	IdempotencyKey string
	// Quote is the message this one replies to; nil when it quotes nothing.
	Quote *Quote
}

// ContactMessage is a contact card to send. It goes without caption, so without
// the nickname of the agent. IdempotencyKey and Quote work as in TextMessage.
type ContactMessage struct {
	SectorID       int64
	To             string
	Card           ContactCard
	IdempotencyKey string
	// Quote is the message this one replies to; nil when it quotes nothing.
	Quote *Quote
}

// Reaction is the reaction of the sector number to a message of a chat with a
// contact. It points at the target only by its provider message ID, which
// every provider has. It goes without the nickname of the agent.
type Reaction struct {
	SectorID int64
	// To is the provider contact ID of the chat, as in TextMessage.
	To string
	// TargetExternalMessageID is the provider ID of the message reacted to.
	TargetExternalMessageID string
	// TargetFromSector reports a target sent by the sector number (from the
	// system or the phone) rather than received from the contact. Providers
	// whose protocol needs the author of the target use it; others ignore it.
	TargetFromSector bool
	// Emoji is the reaction; empty removes the one the sector had set.
	Emoji string
}

// MessageEdit is the new text or caption of a message sent by the sector
// number through the system. It points at the target only by its provider
// message ID; the edit is not a new message and the file does not change.
type MessageEdit struct {
	SectorID int64
	// To is the provider contact ID of the chat, as in TextMessage.
	To string
	// TargetExternalMessageID is the provider ID of the edited message.
	TargetExternalMessageID string
	// Type is the type of the edited message: text, or the attachment
	// (image, video, document) whose caption changes. Audio has no caption.
	Type MessageType
	// Body is the whole new text or caption, as the contact sees it.
	Body string
	// IdempotencyKey makes a retry reuse the same provider event instead of
	// editing twice, as in TextMessage.
	IdempotencyKey string
}

// MessageRevoke is the deletion for everyone of a message sent by the sector
// number through the system. It points at the target only by its provider
// message ID.
type MessageRevoke struct {
	SectorID int64
	// To is the provider contact ID of the chat, as in TextMessage.
	To string
	// TargetExternalMessageID is the provider ID of the deleted message.
	TargetExternalMessageID string
	// IdempotencyKey makes a retry reuse the same provider event, as in MessageEdit.
	IdempotencyKey string
}

// Capabilities tells what the provider supports on a message already sent.
// A zero window means the provider does not support the action at all: the
// system must report it as unavailable, never simulate a success. The windows
// count from the original send and are the policy of the provider, not a
// guarantee that every device of the contact applies the change.
type Capabilities struct {
	// EditWindow is how long after the send the text or caption may be edited.
	EditWindow time.Duration
	// RevokeWindow is how long after the send a message may be deleted for everyone.
	RevokeWindow time.Duration
	// ReceivesChanges reports that the provider delivers MessageEdited and
	// MessageRevoked events. Without it, edits and deletions made outside the
	// system never reach it.
	ReceivesChanges bool
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
	// SendContact sends a contact card and returns the provider message ID.
	SendContact(ctx context.Context, msg ContactMessage) (string, error)
	// SendReaction sets the reaction of the sector number to a message, or
	// removes it with an empty Emoji. It returns ErrNotConnected without a
	// session and ErrNotAccepted for any refusal of the provider. Nothing may
	// expect a delivery or read confirmation of a reaction.
	SendReaction(ctx context.Context, r Reaction) error
	// EditMessage replaces the text or caption of a message the sector number
	// sent through the system, and RevokeMessage deletes it for everyone.
	// Both return the provider ID of the change itself, which its echo
	// carries as ExternalEventID. They return ErrNotConnected without a
	// session, ErrUnsupported when the provider has no such action and
	// ErrNotAccepted for any refusal of the provider, the end of its window
	// included: the change was not made. Any other error means the result is
	// unknown, as after a timeout, and nothing may take it as a success or
	// a refusal. Accepted is not a guarantee that every device of the contact
	// applies the change.
	EditMessage(ctx context.Context, edit MessageEdit) (string, error)
	RevokeMessage(ctx context.Context, revoke MessageRevoke) (string, error)
	// ResolveContact returns the provider contact ID of a phone with country code.
	ResolveContact(ctx context.Context, sectorID int64, phone string) (string, error)
	// ProfilePicture returns the current profile picture of a contact. The
	// existingID is the provider identifier of the picture already stored;
	// when it is still current, the result is Unchanged, so nothing is
	// downloaded again. A contact without a picture, or that hides it, is
	// None, not an error. Without a session it returns ErrNotConnected; any
	// other failure is an error, and the result is unknown, so nothing may
	// change.
	ProfilePicture(ctx context.Context, sectorID int64, contactID, existingID string) (ProfilePicture, error)
	// Capabilities reports what the provider supports on a message already sent.
	Capabilities() Capabilities
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
