// Package fake is a messaging provider that simulates WhatsApp, used by the
// integration tests and, with MESSAGING_PROVIDER=fake, by the end-to-end
// tests against the real server. Tests drive it through Pair, NextQR, Drop and
// LogOut (or the HTTP routes of Handler) as if a phone were on the other side.
package fake

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

var (
	ErrNotPairing = errors.New("sector is not pairing")
	// ErrDeviceUnreachable simulates a device that cannot be told of the unlink.
	ErrDeviceUnreachable = errors.New("device unreachable")
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
	sent  map[string]string
	Sent  []any
}

var (
	_ messaging.Provider    = (*Adapter)(nil)
	_ messaging.QRPairing   = (*Adapter)(nil)
	_ messaging.ContactBook = (*Adapter)(nil)
)

func New(handler messaging.EventHandler) *Adapter {
	return &Adapter{
		handler:     handler,
		sessions:    map[int64]*session{},
		revoked:     map[revokedAccount]bool{},
		unreachable: map[int64]bool{},
		saved:       map[int64][]messaging.SavedContact{},
		sent:        map[string]string{},
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

func (a *Adapter) SendText(_ context.Context, msg messaging.TextMessage) (string, error) {
	return a.send(msg.SectorID, msg.IdempotencyKey, msg)
}

func (a *Adapter) SendMedia(_ context.Context, msg messaging.MediaMessage) (string, error) {
	return a.send(msg.SectorID, msg.IdempotencyKey, msg)
}

// send records the message once per idempotency key, like the real provider
// reusing the message ID.
func (a *Adapter) send(sectorID int64, key string, msg any) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.session(sectorID).status != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	if id, ok := a.sent[key]; ok && key != "" {
		return id, nil
	}
	a.Sent = append(a.Sent, msg)
	// Derived from the key, like Whatsmeow, so the ID survives a restart.
	id := fmt.Sprintf("fake-msg-%d", len(a.Sent))
	if key != "" {
		id = "fake-msg-" + key
		a.sent[key] = id
	}
	return id, nil
}

// SentMessages returns a copy of what was handed to the provider, in order.
func (a *Adapter) SentMessages() []any {
	a.mu.Lock()
	defer a.mu.Unlock()
	return append([]any(nil), a.Sent...)
}

// UpdateStatus simulates the contact's phone confirming the delivery or the
// reading of sent messages.
func (a *Adapter) UpdateStatus(ctx context.Context, sectorID int64, status messaging.DeliveryStatus, externalIDs ...string) error {
	return a.handler(ctx, messaging.StatusUpdated{SectorID: sectorID, ExternalMessageIDs: externalIDs, Status: status, At: time.Now()})
}

func (a *Adapter) ResolveContact(_ context.Context, sectorID int64, phone string) (string, error) {
	if a.Status(sectorID) != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	return phone + "@fake", nil
}
