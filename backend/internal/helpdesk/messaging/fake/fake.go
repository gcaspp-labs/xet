// Package fake is a messaging provider that simulates WhatsApp, used by the
// integration tests and, with MESSAGING_PROVIDER=fake, by the end-to-end
// tests against the real server. Tests drive it through Pair, NextQR, Drop and
// LogOut (or the HTTP routes of Handler) as if a phone were on the other side.
package fake

import (
	"bytes"
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

var (
	ErrNotPairing = errors.New("sector is not pairing")
	// ErrDeviceUnreachable simulates a device that cannot be told of the unlink.
	ErrDeviceUnreachable = errors.New("device unreachable")
	// ErrProfilePictureUnreachable simulates a profile picture lookup that fails.
	ErrProfilePictureUnreachable = errors.New("profile picture lookup failed")
)

var phoneAccount = regexp.MustCompile(`^[0-9]{10,15}$`)

type session struct {
	status    messaging.ConnectionStatus
	accountID string
	qr        string
}

type revokedAccount struct {
	sectorID  int64
	accountID string
}

// profilePicture is a generated profile picture of a contact, kept in memory.
type profilePicture struct {
	id        string
	thumbnail []byte
	full      []byte
}

type Adapter struct {
	handler messaging.EventHandler

	mu       sync.Mutex
	sessions map[int64]*session
	qrCount  int
	// Accounts unlinked by the phone, per sector like a device of the provider;
	// connecting with them fails as logged out.
	revoked map[revokedAccount]bool
	// Sectors whose next Disconnect cannot reach the device.
	unreachable map[int64]bool
	// Address book of each sector number.
	saved map[int64][]messaging.SavedContact
	// Sectors whose next reaction the provider refuses.
	refuseReaction map[int64]bool
	// Sectors whose next edit or deletion for everyone fails with the error.
	failChange map[int64]error
	// Sectors whose next send fails with the error.
	failSend map[int64]error
	// Sectors whose sends wait for Release, to keep a message pending.
	held map[int64]chan struct{}
	// What the provider supports on a message already sent; see SetCapabilities.
	capabilities messaging.Capabilities
	sent         map[string]string
	outbox       []sentEntry
	// Generated profile picture of each contact, by provider contact ID.
	pictures     map[string]*profilePicture
	pictureCount int
	// Absolute base of the image URLs returned by ProfilePicture. The HTTP
	// control route sets it from the request; tests may set it themselves.
	pictureBase string
	// Sectors whose next profile picture lookup fails with the error.
	failPicture map[int64]error
	// Sectors whose next contact resolution fails with the error.
	failResolve map[int64]error
}

// sentEntry is one of what was handed to the provider, with the ID it returned
// for it (empty for a reaction, which returns none).
type sentEntry struct {
	id      string
	message any
}

var (
	_ messaging.Provider    = (*Adapter)(nil)
	_ messaging.QRPairing   = (*Adapter)(nil)
	_ messaging.ContactBook = (*Adapter)(nil)
)

func New(handler messaging.EventHandler) *Adapter {
	return &Adapter{
		handler:        handler,
		sessions:       map[int64]*session{},
		revoked:        map[revokedAccount]bool{},
		unreachable:    map[int64]bool{},
		saved:          map[int64][]messaging.SavedContact{},
		sent:           map[string]string{},
		refuseReaction: map[int64]bool{},
		failChange:     map[int64]error{},
		failSend:       map[int64]error{},
		held:           map[int64]chan struct{}{},
		capabilities:   DefaultCapabilities,
		pictures:       map[string]*profilePicture{},
		failPicture:    map[int64]error{},
		failResolve:    map[int64]error{},
	}
}

func (a *Adapter) session(sectorID int64) *session {
	s, ok := a.sessions[sectorID]
	if !ok {
		s = &session{status: messaging.StatusDisconnected}
		a.sessions[sectorID] = s
	}
	return s
}

// accountPhone reads the phone of accounts like 5511999990000@s.whatsapp.net,
// as Whatsmeow does; other accounts have no phone.
func accountPhone(accountID string) string {
	user, _, _ := strings.Cut(accountID, "@")
	if !phoneAccount.MatchString(user) {
		return ""
	}
	return user
}

// set changes the session under the lock and emits the change after
// releasing it, so the handler may call back into the adapter.
func (a *Adapter) set(ctx context.Context, sectorID int64, change func(s *session)) error {
	a.mu.Lock()
	s := a.session(sectorID)
	change(s)
	ev := messaging.ConnectionChanged{SectorID: sectorID, Status: s.status}
	if s.status == messaging.StatusConnected {
		ev.AccountID = s.accountID
		ev.Phone = accountPhone(s.accountID)
	}
	a.mu.Unlock()
	return a.handler(ctx, ev)
}

// Connect reconnects a known account at once; without one it starts pairing
// with a new QR code.
func (a *Adapter) Connect(ctx context.Context, account messaging.Account) error {
	a.mu.Lock()
	current := a.session(account.SectorID).status
	revoked := a.revoked[revokedAccount{account.SectorID, account.AccountID}]
	a.mu.Unlock()
	if current == messaging.StatusConnected {
		return nil
	}

	switch {
	case account.AccountID != "" && revoked:
		return a.set(ctx, account.SectorID, func(s *session) {
			s.status, s.accountID, s.qr = messaging.StatusLoggedOut, "", ""
		})
	case account.AccountID != "":
		if err := a.set(ctx, account.SectorID, func(s *session) {
			s.status, s.accountID, s.qr = messaging.StatusConnecting, account.AccountID, ""
		}); err != nil {
			return err
		}
		return a.set(ctx, account.SectorID, func(s *session) { s.status = messaging.StatusConnected })
	default:
		return a.set(ctx, account.SectorID, func(s *session) {
			a.qrCount++
			s.status, s.accountID = messaging.StatusConnecting, ""
			s.qr = fmt.Sprintf("fake-qr-%d-%d", account.SectorID, a.qrCount)
		})
	}
}

// Pair simulates the phone reading the QR code of a pairing sector.
func (a *Adapter) Pair(ctx context.Context, sectorID int64, accountID string) error {
	a.mu.Lock()
	pairing := a.session(sectorID).qr != ""
	a.mu.Unlock()
	if !pairing {
		return ErrNotPairing
	}
	return a.set(ctx, sectorID, func(s *session) {
		s.status, s.accountID, s.qr = messaging.StatusConnected, accountID, ""
	})
}

// NextQR simulates the provider replacing the QR code of a pairing, as
// WhatsApp does every 20 seconds.
func (a *Adapter) NextQR(ctx context.Context, sectorID int64) error {
	a.mu.Lock()
	pairing := a.session(sectorID).qr != ""
	a.mu.Unlock()
	if !pairing {
		return ErrNotPairing
	}
	return a.set(ctx, sectorID, func(s *session) {
		a.qrCount++
		s.qr = fmt.Sprintf("fake-qr-%d-%d", sectorID, a.qrCount)
	})
}

// Drop simulates a lost connection that keeps the account linked.
func (a *Adapter) Drop(ctx context.Context, sectorID int64) error {
	return a.set(ctx, sectorID, func(s *session) {
		s.status, s.qr = messaging.StatusDisconnected, ""
	})
}

// Hold makes the sends of the sector wait, so the message stays pending until
// Release. Holding twice keeps the first wait.
func (a *Adapter) Hold(sectorID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.held[sectorID] == nil {
		a.held[sectorID] = make(chan struct{})
	}
}

// Release lets the waiting sends of the sector go on, and the next ones too.
func (a *Adapter) Release(sectorID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if ch := a.held[sectorID]; ch != nil {
		close(ch)
		delete(a.held, sectorID)
	}
}

// LogOut simulates the phone unlinking the account.
func (a *Adapter) LogOut(ctx context.Context, sectorID int64) error {
	return a.set(ctx, sectorID, func(s *session) {
		if s.accountID != "" {
			a.revoked[revokedAccount{sectorID, s.accountID}] = true
		}
		s.status, s.accountID, s.qr = messaging.StatusLoggedOut, "", ""
	})
}

// Receive delivers a message from a contact to the sector number.
func (a *Adapter) Receive(ctx context.Context, sectorID int64, msg messaging.Message) error {
	return a.handler(ctx, messaging.MessageReceived{SectorID: sectorID, Message: msg})
}

// SendOutside delivers a message sent from the phone of the sector.
func (a *Adapter) SendOutside(ctx context.Context, sectorID int64, msg messaging.Message) error {
	return a.handler(ctx, messaging.MessageSentOutside{SectorID: sectorID, Message: msg})
}

// DefaultCapabilities are those of WhatsApp: edit within 15 minutes, delete
// for everyone within two days, and edits and deletions made outside the
// system delivered as events.
var DefaultCapabilities = messaging.Capabilities{
	EditWindow: 15 * time.Minute, RevokeWindow: 48 * time.Hour, ReceivesChanges: true,
}

// SetCapabilities changes what the provider supports, to simulate a provider
// without an action (a zero window) or that does not deliver changes.
func (a *Adapter) SetCapabilities(c messaging.Capabilities) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.capabilities = c
}

// Capabilities reports what the provider supports on a message already sent.
func (a *Adapter) Capabilities() messaging.Capabilities {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.capabilities
}

// Edit delivers an edit of the message with the given provider ID, made by
// the contact or, with FromSector, from the phone of the sector (or the echo
// of one made through the system). Calling it again with the same event
// simulates a redelivery; an older At, a late event; calling it before the
// original message is received, an edit that arrives first. A provider that
// does not deliver changes (ReceivesChanges false) drops it.
func (a *Adapter) Edit(ctx context.Context, sectorID int64, ev messaging.MessageEdited) error {
	ev.SectorID = sectorID
	if ev.At.IsZero() {
		ev.At = time.Now()
	}
	if !a.Capabilities().ReceivesChanges {
		return nil
	}
	return a.handler(ctx, ev)
}

// Revoke delivers a deletion for everyone of the message with the given
// provider ID, with the same simulations as Edit.
func (a *Adapter) Revoke(ctx context.Context, sectorID int64, ev messaging.MessageRevoked) error {
	ev.SectorID = sectorID
	if ev.At.IsZero() {
		ev.At = time.Now()
	}
	if !a.Capabilities().ReceivesChanges {
		return nil
	}
	return a.handler(ctx, ev)
}

// React delivers a reaction of a contact (or, with fromSectorPhone, one made
// from the phone of the sector) to the message with the given provider ID. An
// empty emoji removes the reaction.
func (a *Adapter) React(ctx context.Context, sectorID int64, ev messaging.ReactionReceived) error {
	ev.SectorID = sectorID
	if ev.At.IsZero() {
		ev.At = time.Now()
	}
	return a.handler(ctx, ev)
}

// Disconnect unlinks the account. An unreachable device ends the session the
// same way and reports the error, like the real provider.
func (a *Adapter) Disconnect(ctx context.Context, sectorID int64) error {
	a.mu.Lock()
	unreachable := a.unreachable[sectorID]
	delete(a.unreachable, sectorID)
	a.mu.Unlock()
	if err := a.LogOut(ctx, sectorID); err != nil {
		return err
	}
	if unreachable {
		return ErrDeviceUnreachable
	}
	return nil
}

// FailNextDisconnect makes the next Disconnect of the sector unable to reach the device.
func (a *Adapter) FailNextDisconnect(sectorID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.unreachable[sectorID] = true
}

func (a *Adapter) Status(sectorID int64) messaging.ConnectionStatus {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.session(sectorID).status
}

func (a *Adapter) QRCode(sectorID int64) (string, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	qr := a.session(sectorID).qr
	return qr, qr != ""
}

// SetSavedContacts simulates the address book of the sector number.
func (a *Adapter) SetSavedContacts(sectorID int64, contacts ...messaging.SavedContact) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.saved[sectorID] = contacts
}

func (a *Adapter) SavedContacts(_ context.Context, sectorID int64) ([]messaging.SavedContact, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return nil, messaging.ErrNotConnected
	}
	return append([]messaging.SavedContact(nil), a.saved[sectorID]...), nil
}

// SendText records the text among the sent messages, with the quote it
// carries (the ID and, when given, the author and the snippet).
func (a *Adapter) SendText(_ context.Context, msg messaging.TextMessage) (string, error) {
	return a.send(msg.SectorID, msg.IdempotencyKey, msg)
}

// SendMedia records the attachment like SendText, quote included.
func (a *Adapter) SendMedia(_ context.Context, msg messaging.MediaMessage) (string, error) {
	return a.send(msg.SectorID, msg.IdempotencyKey, msg)
}

// SendContact records the card like SendText, quote included.
func (a *Adapter) SendContact(_ context.Context, msg messaging.ContactMessage) (string, error) {
	return a.send(msg.SectorID, msg.IdempotencyKey, msg)
}

// send records the message once per idempotency key, like the real provider
// reusing the message ID.
func (a *Adapter) send(sectorID int64, key string, msg any) (string, error) {
	a.mu.Lock()
	held := a.held[sectorID]
	a.mu.Unlock()
	if held != nil {
		<-held
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	if err := a.failSend[sectorID]; err != nil {
		delete(a.failSend, sectorID)
		return "", err
	}
	if id, ok := a.sent[key]; ok && key != "" {
		return id, nil
	}
	// Derived from the key, like Whatsmeow, so the ID survives a restart.
	id := fmt.Sprintf("fake-msg-%d", len(a.outbox)+1)
	if key != "" {
		id = "fake-msg-" + key
		a.sent[key] = id
	}
	a.outbox = append(a.outbox, sentEntry{id: id, message: msg})
	return id, nil
}

// SendReaction records the reaction (or, with an empty emoji, the removal)
// among the sent messages. A refusal set by FailNextReaction comes back as
// the neutral error, like any refusal of the real provider.
func (a *Adapter) SendReaction(_ context.Context, r messaging.Reaction) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(r.SectorID).status != messaging.StatusConnected {
		return messaging.ErrNotConnected
	}
	if a.refuseReaction[r.SectorID] {
		delete(a.refuseReaction, r.SectorID)
		return messaging.ErrNotAccepted
	}
	a.outbox = append(a.outbox, sentEntry{message: r})
	return nil
}

// FailNextReaction makes the provider refuse the next reaction of the sector.
func (a *Adapter) FailNextReaction(sectorID int64) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.refuseReaction[sectorID] = true
}

// EditMessage records the edit among the sent messages and returns the ID of
// the edit event, derived from the idempotency key like a message ID: the
// same key edits once. Without edits in the capabilities it is unsupported.
func (a *Adapter) EditMessage(ctx context.Context, edit messaging.MessageEdit) (string, error) {
	return a.change(ctx, edit.SectorID, "fake-edit-", edit.IdempotencyKey, edit, func(c messaging.Capabilities) bool { return c.EditWindow > 0 })
}

// RevokeMessage records the deletion for everyone like EditMessage.
func (a *Adapter) RevokeMessage(ctx context.Context, revoke messaging.MessageRevoke) (string, error) {
	return a.change(ctx, revoke.SectorID, "fake-revoke-", revoke.IdempotencyKey, revoke, func(c messaging.Capabilities) bool { return c.RevokeWindow > 0 })
}

// change waits while the sector is held, like a send, and gives up when the
// time of the request runs out, as WhatsApp does: the result is unknown.
func (a *Adapter) change(ctx context.Context, sectorID int64, prefix, key string, change any, supported func(messaging.Capabilities) bool) (string, error) {
	a.mu.Lock()
	held := a.held[sectorID]
	a.mu.Unlock()
	if held != nil {
		select {
		case <-held:
		case <-ctx.Done():
			return "", ctx.Err()
		}
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	if !supported(a.capabilities) {
		return "", messaging.ErrUnsupported
	}
	if err := a.failChange[sectorID]; err != nil {
		delete(a.failChange, sectorID)
		return "", err
	}
	id := prefix + key
	if _, ok := a.sent[id]; ok && key != "" {
		return id, nil
	}
	a.sent[id] = id
	a.outbox = append(a.outbox, sentEntry{id: id, message: change})
	return id, nil
}

// FailNextChange makes the next edit or deletion for everyone of the sector
// fail with err: messaging.ErrNotAccepted for a refusal of the provider, or
// any other error (such as context.DeadlineExceeded) for an unknown result.
func (a *Adapter) FailNextChange(sectorID int64, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failChange[sectorID] = err
}

// FailNextSend makes the next text, attachment or card of the sector fail
// with err before reaching WhatsApp, as a query of the provider that fails
// on the way.
func (a *Adapter) FailNextSend(sectorID int64, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failSend[sectorID] = err
}

// SentMessages returns a copy of what was handed to the provider, in order.
func (a *Adapter) SentMessages() []any {
	a.mu.Lock()
	defer a.mu.Unlock()
	sent := make([]any, len(a.outbox))
	for i, entry := range a.outbox {
		sent[i] = entry.message
	}
	return sent
}

// UpdateStatus simulates the contact's phone confirming the delivery or the
// reading of sent messages.
func (a *Adapter) UpdateStatus(ctx context.Context, sectorID int64, status messaging.DeliveryStatus, externalIDs ...string) error {
	return a.handler(ctx, messaging.StatusUpdated{SectorID: sectorID, ExternalMessageIDs: externalIDs, Status: status, At: time.Now()})
}

func (a *Adapter) ResolveContact(_ context.Context, sectorID int64, phone string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	if err := a.failResolve[sectorID]; err != nil {
		delete(a.failResolve, sectorID)
		return "", err
	}
	return phone + "@fake", nil
}

// FailNextResolveContact makes the next ResolveContact of the sector fail with
// err; messaging.ErrContactNotFound stands for a phone without WhatsApp.
func (a *Adapter) FailNextResolveContact(sectorID int64, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failResolve[sectorID] = err
}

// SetProfilePicture gives the contact a generated picture and returns its new
// provider ID. It changes on every call, so a later lookup with the old ID
// reports unchanged.
func (a *Adapter) SetProfilePicture(contactID string) string {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pictureCount++
	p := &profilePicture{
		id:        fmt.Sprintf("fake-photo-%d", a.pictureCount),
		thumbnail: generatedPicture(contactID+"-thumbnail", 32),
		full:      generatedPicture(contactID+"-full", 96),
	}
	a.pictures[contactID] = p
	return p.id
}

// ClearProfilePicture removes the picture of the contact.
func (a *Adapter) ClearProfilePicture(contactID string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	delete(a.pictures, contactID)
}

// SetProfilePictureBaseURL sets the absolute base of the URLs returned by
// ProfilePicture. The HTTP control route sets it from the request, for the
// end-to-end tests; an integration test may set it to its own server.
func (a *Adapter) SetProfilePictureBaseURL(base string) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.pictureBase = strings.TrimRight(base, "/")
}

// FailNextProfilePicture makes the next lookup of the sector fail with err.
func (a *Adapter) FailNextProfilePicture(sectorID int64, err error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.failPicture[sectorID] = err
}

// ProfilePicture returns the generated picture of the contact with the same
// three results of the real provider: found, none and unchanged.
func (a *Adapter) ProfilePicture(_ context.Context, sectorID int64, contactID, existingID string) (messaging.ProfilePicture, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return messaging.ProfilePicture{}, messaging.ErrNotConnected
	}
	if err := a.failPicture[sectorID]; err != nil {
		delete(a.failPicture, sectorID)
		return messaging.ProfilePicture{}, err
	}
	p := a.pictures[contactID]
	if p == nil {
		return messaging.ProfilePicture{Kind: messaging.ProfilePictureNone}, nil
	}
	if existingID != "" && existingID == p.id {
		return messaging.ProfilePicture{Kind: messaging.ProfilePictureUnchanged}, nil
	}
	return messaging.ProfilePicture{
		Kind:         messaging.ProfilePictureFound,
		ID:           p.id,
		ThumbnailURL: a.pictureURL(contactID, "thumbnail"),
		FullURL:      a.pictureURL(contactID, "full"),
	}, nil
}

// ProfilePictureImage returns the generated image of the contact, "thumbnail"
// or "full", for the HTTP route that serves it.
func (a *Adapter) ProfilePictureImage(contactID, size string) ([]byte, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	p := a.pictures[contactID]
	if p == nil {
		return nil, false
	}
	switch size {
	case "thumbnail":
		return append([]byte(nil), p.thumbnail...), true
	case "full":
		return append([]byte(nil), p.full...), true
	}
	return nil, false
}

func (a *Adapter) pictureURL(contactID, size string) string {
	if a.pictureBase == "" {
		return ""
	}
	return a.pictureBase + "/profile-pictures/" + url.PathEscape(contactID) + "/" + size
}

// generatedPicture draws a small image for the fake photo, so the tests never
// use a real one.
func generatedPicture(seed string, size int) []byte {
	img := image.NewRGBA(image.Rect(0, 0, size, size))
	sum := sha256.Sum256([]byte(seed))
	shade := color.RGBA{R: sum[0], G: sum[1], B: sum[2], A: 255}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: shade}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	_ = png.Encode(&buf, img)
	return buf.Bytes()
}
