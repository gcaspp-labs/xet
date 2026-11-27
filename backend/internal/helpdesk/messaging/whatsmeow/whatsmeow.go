// Package whatsmeow implements the messaging contract with Whatsmeow, the
// WhatsApp Web protocol library. It keeps one session per sector, stores the
// device keys in PostgreSQL through sqlstore (tables prefixed whatsmeow_) and
// is the only package that imports Whatsmeow.
package whatsmeow

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waCompanionReg"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// Name shown in the list of linked devices of the phone.
const deviceName = "Central de Atendimento"

// How long Connect waits for the first QR code of a new pairing, so the
// caller can show it right away.
const qrWait = 15 * time.Second

// Timeout to process one event of a session.
const eventTimeout = time.Minute

type Adapter struct {
	container *sqlstore.Container
	handler   messaging.EventHandler
	logger    *slog.Logger

	mu       sync.Mutex
	sessions map[int64]*session
}

var (
	_ messaging.Provider    = (*Adapter)(nil)
	_ messaging.QRPairing   = (*Adapter)(nil)
	_ messaging.ContactBook = (*Adapter)(nil)
)

// New opens the device store in the service database, creating or upgrading
// the whatsmeow_ tables.
func New(ctx context.Context, pool *pgxpool.Pool, handler messaging.EventHandler, logger *slog.Logger) (*Adapter, error) {
	store.SetOSInfo(deviceName, [3]uint32{1, 0, 0})
	// With an unknown platform the phone shows "Outro dispositivo" instead of
	// the name. It is sent only when pairing: a linked number must pair again.
	store.DeviceProps.PlatformType = waCompanionReg.DeviceProps_DESKTOP.Enum()
	container := sqlstore.NewWithDB(stdlib.OpenDBFromPool(pool), "pgx", newLogger(logger, "store"))
	if err := container.Upgrade(ctx); err != nil {
		_ = container.Close()
		return nil, fmt.Errorf("upgrade whatsmeow store: %w", err)
	}
	return &Adapter{
		container: container,
		handler:   handler,
		logger:    logger,
		sessions:  map[int64]*session{},
	}, nil
}

// Close ends the connections without unlinking the accounts, so the next
// start reconnects them.
func (a *Adapter) Close() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	for _, s := range a.sessions {
		s.client.Disconnect()
	}
	return a.container.Close()
}

// editWindow is the time WhatsApp gives to edit a message: 15 minutes
// (https://about.fb.com/news/2023/05/edit-whatsapp-messages/). Whatsmeow
// itself declares 20 minutes (whatsmeow.EditWindow); the system follows the
// provider (spec #290).
const editWindow = 15 * time.Minute

// revokeWindow is the time WhatsApp describes to delete a message for
// everyone, two days (https://faq.whatsapp.com/1370476507114859/). It is the
// policy of the provider, not a guarantee: the provider may still refuse.
const revokeWindow = 48 * time.Hour

// Capabilities reports the edit and deletion windows of WhatsApp, and that
// edits and deletions made outside the system are delivered as events.
func (a *Adapter) Capabilities() messaging.Capabilities {
	return messaging.Capabilities{EditWindow: editWindow, RevokeWindow: revokeWindow, ReceivesChanges: true}
}

func (a *Adapter) emit(ev messaging.Event) error {
	ctx, cancel := context.WithTimeout(context.Background(), eventTimeout)
	defer cancel()
	if err := a.handler(ctx, ev); err != nil {
		a.logger.Error("messaging event not processed", "sector_id", ev.Sector(), "event", fmt.Sprintf("%T", ev), "error", err)
		return err
	}
	return nil
}

// Connect starts the session of the sector. A known account reconnects with
// its stored keys; without one, a new device pairs by QR code and Connect
// waits for the first code. An account missing from the store is reported as
// logged out, so the sector asks for a new QR code.
func (a *Adapter) Connect(ctx context.Context, account messaging.Account) error {
	a.mu.Lock()
	if s, ok := a.sessions[account.SectorID]; ok {
		if s.active() {
			a.mu.Unlock()
			return nil
		}
		s.client.Disconnect()
		delete(a.sessions, account.SectorID)
	}

	device, err := a.device(ctx, account.AccountID)
	if err != nil {
		a.mu.Unlock()
		return err
	}
	if device == nil {
		a.mu.Unlock()
		return a.emit(messaging.ConnectionChanged{SectorID: account.SectorID, Status: messaging.StatusLoggedOut})
	}

	s := &session{
		sectorID: account.SectorID,
		adapter:  a,
		client:   whatsmeow.NewClient(device, newLogger(a.logger, fmt.Sprintf("sector-%d", account.SectorID))),
		status:   messaging.StatusConnecting,
	}
	s.client.AddEventHandlerWithSuccessStatus(s.handle)
	var qrReady chan struct{}
	if s.client.Store.ID == nil {
		qr, err := s.client.GetQRChannel(context.WithoutCancel(ctx))
		if err != nil {
			a.mu.Unlock()
			return fmt.Errorf("qr channel: %w", err)
		}
		qrReady = make(chan struct{})
		go s.watchQR(qr, qrReady)
	}
	a.sessions[account.SectorID] = s
	a.mu.Unlock()

	_ = a.emit(messaging.ConnectionChanged{SectorID: account.SectorID, Status: messaging.StatusConnecting})
	if err := s.client.Connect(); err != nil {
		s.changed(messaging.StatusDisconnected)
		return fmt.Errorf("connect: %w", err)
	}
	if qrReady != nil {
		select {
		case <-qrReady:
		case <-time.After(qrWait):
		case <-ctx.Done():
		}
	}
	return nil
}

// device returns the stored device of the account, a new device when there
// is no account, or nil when the account is no longer in the store.
//
// The store keys a device by its full JID, with the device part
// (5511999999999:23@s.whatsapp.net), while the account is saved without it
// (5511999999999@s.whatsapp.net). Either form finds the only stored device of
// the same number. More than one is not guessed, even when the full JID names
// one of them: it is logged and treated as logged out.
func (a *Adapter) device(ctx context.Context, accountID string) (*store.Device, error) {
	if accountID == "" {
		return a.container.NewDevice(), nil
	}
	jid, err := types.ParseJID(accountID)
	if err != nil {
		return nil, fmt.Errorf("parse account %q: %w", accountID, err)
	}
	all, err := a.container.GetAllDevices(ctx)
	if err != nil {
		return nil, fmt.Errorf("get all devices: %w", err)
	}
	account := jid.ToNonAD()
	var found []*store.Device
	for _, d := range all {
		if d.ID != nil && d.ID.ToNonAD() == account {
			found = append(found, d)
		}
	}
	switch len(found) {
	case 0:
		return nil, nil
	case 1:
		return found[0], nil
	}
	ids := make([]string, len(found))
	for i, d := range found {
		ids[i] = d.ID.String()
	}
	a.logger.Error("whatsapp account has more than one stored device: treated as logged out", "account_id", accountID, "devices", ids)
	return nil, nil
}

// Disconnect unlinks the account of the sector from the phone and deletes its
// keys. When the phone cannot be told, the session ends and the keys go anyway,
// and the error asks for the device to be removed by the phone.
func (a *Adapter) Disconnect(ctx context.Context, sectorID int64) error {
	a.mu.Lock()
	s, ok := a.sessions[sectorID]
	delete(a.sessions, sectorID)
	a.mu.Unlock()
	if !ok {
		return messaging.ErrNotConnected
	}
	err := s.unlink(ctx)
	s.changed(messaging.StatusLoggedOut)
	return err
}

func (a *Adapter) Status(sectorID int64) messaging.ConnectionStatus {
	a.mu.Lock()
	s, ok := a.sessions[sectorID]
	a.mu.Unlock()
	if !ok {
		return messaging.StatusDisconnected
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status
}

func (a *Adapter) QRCode(sectorID int64) (string, bool) {
	a.mu.Lock()
	s, ok := a.sessions[sectorID]
	a.mu.Unlock()
	if !ok {
		return "", false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.qr, s.qr != ""
}

// client returns the logged-in client of the sector.
func (a *Adapter) client(sectorID int64) (*whatsmeow.Client, error) {
	a.mu.Lock()
	s, ok := a.sessions[sectorID]
	a.mu.Unlock()
	if !ok || !s.client.IsLoggedIn() {
		return nil, messaging.ErrNotConnected
	}
	return s.client, nil
}

func (a *Adapter) ResolveContact(ctx context.Context, sectorID int64, phone string) (string, error) {
	cli, err := a.client(sectorID)
	if err != nil {
		return "", err
	}
	// The server also matches numbers with or without the Brazilian ninth digit.
	resp, err := cli.IsOnWhatsApp(ctx, []string{"+" + phone})
	if err != nil {
		return "", fmt.Errorf("is on whatsapp: %w", err)
	}
	if len(resp) == 0 || !resp[0].IsIn {
		return "", messaging.ErrContactNotFound
	}
	return resp[0].JID.String(), nil
}

// profilePictureInfo asks WhatsApp for the picture of a JID, as
// whatsmeow.Client.GetProfilePictureInfo; tests pass their own.
type profilePictureInfo func(ctx context.Context, jid types.JID, params *whatsmeow.GetProfilePictureParams) (*types.ProfilePictureInfo, error)

// ProfilePicture asks WhatsApp for the picture of the contact. Two queries
// are needed: the preview gives the thumbnail, the normal one the full image.
// Both carry the existing ID, so WhatsApp answers nil, without error, when the
// picture has not changed.
func (a *Adapter) ProfilePicture(ctx context.Context, sectorID int64, contactID, existingID string) (messaging.ProfilePicture, error) {
	cli, err := a.client(sectorID)
	if err != nil {
		return messaging.ProfilePicture{}, err
	}
	jid, err := types.ParseJID(contactID)
	if err != nil {
		return messaging.ProfilePicture{}, fmt.Errorf("parse contact %q: %w", contactID, err)
	}
	return profilePicture(ctx, cli.GetProfilePictureInfo, jid, existingID)
}

// profilePicture fetches the preview and the full picture and translates the
// provider answer into the neutral result. A nil answer with an existing ID
// means the picture has not changed. "Not set" and "hidden" are no picture,
// not an error; any other failure is an error and the result is unknown.
func profilePicture(ctx context.Context, lookup profilePictureInfo, jid types.JID, existingID string) (messaging.ProfilePicture, error) {
	preview, err := lookup(ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: true, ExistingID: existingID})
	if err != nil {
		return profilePictureError(err)
	}
	if preview == nil {
		return profilePictureEmpty(existingID)
	}
	full, err := lookup(ctx, jid, &whatsmeow.GetProfilePictureParams{ExistingID: existingID})
	if err != nil {
		return profilePictureError(err)
	}
	if full == nil {
		// Rare case: the preview came back new but the full picture came empty,
		// which only happens if the picture changes between the two queries.
		// With an existing ID the empty answer reads as unchanged, so the swap
		// just waits for the next fetch.
		return profilePictureEmpty(existingID)
	}
	return messaging.ProfilePicture{
		Kind:         messaging.ProfilePictureFound,
		ID:           full.ID,
		ThumbnailURL: preview.URL,
		FullURL:      full.URL,
	}, nil
}

// profilePictureEmpty reads an empty answer of WhatsApp: with an existing ID
// the picture is the same one, without it nothing was found.
func profilePictureEmpty(existingID string) (messaging.ProfilePicture, error) {
	if existingID != "" {
		return messaging.ProfilePicture{Kind: messaging.ProfilePictureUnchanged}, nil
	}
	return messaging.ProfilePicture{}, errors.New("profile picture: empty answer")
}

// profilePictureError translates the two "no picture" answers of WhatsApp into
// None, without error, and lets any other failure through.
func profilePictureError(err error) (messaging.ProfilePicture, error) {
	if errors.Is(err, whatsmeow.ErrProfilePictureNotSet) || errors.Is(err, whatsmeow.ErrProfilePictureUnauthorized) {
		return messaging.ProfilePicture{Kind: messaging.ProfilePictureNone}, nil
	}
	return messaging.ProfilePicture{}, fmt.Errorf("get profile picture: %w", err)
}

// SavedContacts reads the address book synced from the phone. A contact known
// by LID gets its phone from the LID mappings of the store, and one without a
// saved name or a known phone is left out.
func (a *Adapter) SavedContacts(ctx context.Context, sectorID int64) ([]messaging.SavedContact, error) {
	cli, err := a.client(sectorID)
	if err != nil {
		return nil, err
	}
	all, err := cli.Store.Contacts.GetAllContacts(ctx)
	if err != nil {
		return nil, fmt.Errorf("get all contacts: %w", err)
	}
	out := make([]messaging.SavedContact, 0, len(all))
	for jid, info := range all {
		name := info.FullName
		if name == "" {
			name = info.FirstName
		}
		if name == "" {
			continue
		}
		switch jid.Server {
		case types.DefaultUserServer:
		case types.HiddenUserServer:
			if jid, err = cli.Store.LIDs.GetPNForLID(ctx, jid); err != nil || jid.IsEmpty() {
				continue
			}
		default:
			continue
		}
		out = append(out, messaging.SavedContact{Name: name, Phone: jid.User})
	}
	return out, nil
}

// messageID derives the WhatsApp message ID from the idempotency key, so a
// retry sends the same message ID instead of a new message.
func messageID(cli *whatsmeow.Client, key string) types.MessageID {
	if key == "" {
		return cli.GenerateMessageID()
	}
	hash := sha256.Sum256([]byte(key))
	return whatsmeow.WebMessageIDPrefix + strings.ToUpper(hex.EncodeToString(hash[:9]))
}

type session struct {
	sectorID int64
	adapter  *Adapter
	client   *whatsmeow.Client
	// downloads fetches the file of a media message; nil uses the client. Tests
	// set their own, since a real download needs the WhatsApp connection.
	downloads mediaDownloader

	mu     sync.Mutex
	status messaging.ConnectionStatus
	qr     string
}

// active reports a session connected or on its way, which Connect keeps.
func (s *session) active() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.status == messaging.StatusConnected || s.status == messaging.StatusConnecting
}

// unlink removes the device from the phone and the store. A pairing has no
// device yet: it only stops.
func (s *session) unlink(ctx context.Context) error {
	if s.client.Store.ID == nil {
		s.client.Disconnect()
		return nil
	}
	err := s.client.Logout(ctx)
	if err == nil {
		return nil
	}
	s.client.Disconnect()
	if deleteErr := s.client.Store.Delete(ctx); deleteErr != nil {
		return errors.Join(fmt.Errorf("logout: %w", err), fmt.Errorf("delete device: %w", deleteErr))
	}
	return fmt.Errorf("logout: %w", err)
}

// changed records the new status and emits it when it differs.
func (s *session) changed(status messaging.ConnectionStatus) {
	s.mu.Lock()
	same := s.status == status
	s.status = status
	if status != messaging.StatusConnecting {
		s.qr = ""
	}
	s.mu.Unlock()
	if same {
		return
	}
	ev := messaging.ConnectionChanged{SectorID: s.sectorID, Status: status}
	if status == messaging.StatusConnected && s.client.Store.ID != nil {
		ev.AccountID = s.client.Store.ID.ToNonAD().String()
		ev.Phone = s.client.Store.ID.User
	}
	_ = s.adapter.emit(ev)
}

// watchQR keeps the current code of a pairing until it succeeds or expires.
// Each new code is reported as connecting again, so the screen shows it.
func (s *session) watchQR(ch <-chan whatsmeow.QRChannelItem, ready chan struct{}) {
	var once sync.Once
	signal := func() { once.Do(func() { close(ready) }) }
	defer signal()
	for item := range ch {
		switch item.Event {
		case whatsmeow.QRChannelEventCode:
			s.mu.Lock()
			s.qr = item.Code
			s.mu.Unlock()
			signal()
			_ = s.adapter.emit(messaging.ConnectionChanged{SectorID: s.sectorID, Status: messaging.StatusConnecting})
		case whatsmeow.QRChannelSuccess.Event:
			s.mu.Lock()
			s.qr = ""
			s.mu.Unlock()
		default:
			// Expired or failed: the next Connect starts a new pairing.
			s.adapter.logger.Warn("whatsapp pairing ended", "sector_id", s.sectorID, "event", item.Event, "error", item.Error)
			s.client.Disconnect()
			s.changed(messaging.StatusDisconnected)
		}
	}
}

// handle translates the Whatsmeow events. Returning false tells Whatsmeow
// the message was not processed, so it is not acknowledged and the server
// delivers it again.
func (s *session) handle(evt any) bool {
	log := s.adapter.logger.With("sector_id", s.sectorID)
	switch v := evt.(type) {
	case *events.Connected:
		s.changed(messaging.StatusConnected)
	case *events.Disconnected:
		// Whatsmeow reconnects on its own and emits Connected again.
		s.changed(messaging.StatusDisconnected)
	case *events.StreamReplaced:
		log.Warn("whatsapp session replaced by another connection")
		s.changed(messaging.StatusDisconnected)
	case *events.LoggedOut:
		log.Warn("whatsapp account unlinked", "reason", v.Reason.String())
		s.changed(messaging.StatusLoggedOut)
	case *events.TemporaryBan:
		log.Error("whatsapp temporary ban", "ban", v.String())
		s.changed(messaging.StatusDisconnected)
	case *events.ConnectFailure:
		log.Error("whatsapp connect failure", "reason", v.Reason.String(), "message", v.Message)
		s.changed(messaging.StatusDisconnected)
	case *events.ClientOutdated:
		log.Error("whatsapp client outdated: update whatsmeow")
		s.changed(messaging.StatusDisconnected)
	case *events.Message:
		return s.message(v)
	case *events.Receipt:
		return s.receipt(v)
	}
	return true
}
