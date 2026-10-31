// Package fake is a messaging provider that simulates WhatsApp, used by the
// integration tests and, with MESSAGING_PROVIDER=fake, by the end-to-end
// tests against the real server. Tests drive it through Pair, Drop and
// LogOut (or the HTTP routes of Handler) as if a phone were on the other side.
package fake

import (
	"context"
	"errors"
	"fmt"
	"sync"

	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

var ErrNotPairing = errors.New("sector is not pairing")

type session struct {
	status    messaging.ConnectionStatus
	accountID string
	qr        string
}

type Adapter struct {
	handler messaging.EventHandler

	mu       sync.Mutex
	sessions map[int64]*session
	qrCount  int
	// Accounts unlinked by the phone; connecting with them fails as logged out.
	revoked map[string]bool
	sent    map[string]string
	Sent    []any
}

var (
	_ messaging.Provider  = (*Adapter)(nil)
	_ messaging.QRPairing = (*Adapter)(nil)
)

func New(handler messaging.EventHandler) *Adapter {
	return &Adapter{
		handler:  handler,
		sessions: map[int64]*session{},
		revoked:  map[string]bool{},
		sent:     map[string]string{},
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

// set changes the session under the lock and emits the change after
// releasing it, so the handler may call back into the adapter.
func (a *Adapter) set(ctx context.Context, sectorID int64, change func(s *session)) error {
	a.mu.Lock()
	s := a.session(sectorID)
	change(s)
	ev := messaging.ConnectionChanged{SectorID: sectorID, Status: s.status}
	if s.status == messaging.StatusConnected {
		ev.AccountID = s.accountID
	}
	a.mu.Unlock()
	return a.handler(ctx, ev)
}

// Connect reconnects a known account at once; without one it starts pairing
// with a new QR code.
func (a *Adapter) Connect(ctx context.Context, account messaging.Account) error {
	a.mu.Lock()
	current := a.session(account.SectorID).status
	revoked := a.revoked[account.AccountID]
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
			a.revoked[s.accountID] = true
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

func (a *Adapter) Disconnect(ctx context.Context, sectorID int64) error {
	return a.LogOut(ctx, sectorID)
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
	id := fmt.Sprintf("fake-msg-%d", len(a.Sent))
	if key != "" {
		a.sent[key] = id
	}
	return id, nil
}

func (a *Adapter) ResolveContact(_ context.Context, sectorID int64, phone string) (string, error) {
	if a.Status(sectorID) != messaging.StatusConnected {
		return "", messaging.ErrNotConnected
	}
	return phone + "@fake", nil
}
