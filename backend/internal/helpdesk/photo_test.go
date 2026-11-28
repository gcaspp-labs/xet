package helpdesk_test

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging/fake"
)

type contactPhotoRow struct {
	MediaID          *int64
	ThumbnailMediaID *int64
	ExternalID       *string
	CheckedAt        *time.Time
}

// serveProfilePictures starts the provider image server the fake points its
// picture URLs to, serving the generated images of the contacts. The fake
// builds the URLs from this base, so the backend downloads them as it would
// download from WhatsApp.
func (e *testEnv) serveProfilePictures() {
	e.T.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/profile-pictures/")
		rawContact, size, ok := strings.Cut(path, "/")
		if !ok || size == "" || strings.Contains(size, "/") {
			http.NotFound(w, r)
			return
		}
		contactID, err := url.PathUnescape(rawContact)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		data, exists := e.WhatsApp.ProfilePictureImage(contactID, size)
		if !exists {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(data)
	}))
	e.T.Cleanup(srv.Close)
	e.WhatsApp.SetProfilePictureBaseURL(srv.URL)
}

func (e *testEnv) contactPhoto(contactID int64) contactPhotoRow {
	e.T.Helper()
	var p contactPhotoRow
	err := e.Pool.QueryRow(e.T.Context(), `
		select photo_media_id, photo_thumbnail_media_id, photo_external_id, photo_checked_at
		from contacts where id = $1`, contactID).
		Scan(&p.MediaID, &p.ThumbnailMediaID, &p.ExternalID, &p.CheckedAt)
	if err != nil {
		e.T.Fatal(err)
	}
	return p
}

func (e *testEnv) contactIDByPhone(phone string) int64 {
	e.T.Helper()
	var id int64
	if err := e.Pool.QueryRow(e.T.Context(), "select id from contacts where phone = $1", phone).Scan(&id); err != nil {
		e.T.Fatal(err)
	}
	return id
}

// backdatePhotoCheck moves the last picture attempt of the contact to more
// than 24 hours ago, so the next ticket looks it up again.
func (e *testEnv) backdatePhotoCheck(contactID int64) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(),
		"update contacts set photo_checked_at = now() - interval '25 hours' where id = $1", contactID); err != nil {
		e.T.Fatal(err)
	}
}

// wantPhotoStored checks the contact and the two stored files of the picture.
func (e *testEnv) wantPhotoStored(contactID int64, providerID string) {
	e.T.Helper()
	p := e.contactPhoto(contactID)
	if p.MediaID == nil || p.ThumbnailMediaID == nil || p.ExternalID == nil || p.CheckedAt == nil {
		e.T.Fatalf("contact picture = %+v, want the two files, the id and the attempt", p)
	}
	if *p.ExternalID != providerID {
		e.T.Fatalf("picture id = %q, want %q", *p.ExternalID, providerID)
	}
	for name, id := range map[string]int64{"picture": *p.MediaID, "thumbnail": *p.ThumbnailMediaID} {
		file := e.media(id)
		if !strings.HasPrefix(file.MimeType, "image/") || file.SizeBytes == 0 || file.Sha256 == "" {
			e.T.Fatalf("%s file = %+v", name, file)
		}
		r, err := e.Files.Open(e.T.Context(), file.StorageKey)
		if err != nil {
			e.T.Fatalf("open %s file: %v", name, err)
		}
		data, err := io.ReadAll(r)
		_ = r.Close()
		if err != nil || int64(len(data)) != file.SizeBytes {
			e.T.Fatalf("%s content = %d bytes (err %v), want %d", name, len(data), err, file.SizeBytes)
		}
	}
}

func (e *testEnv) wantNoPhoto(contactID int64) {
	e.T.Helper()
	p := e.contactPhoto(contactID)
	if p.MediaID != nil || p.ThumbnailMediaID != nil || p.ExternalID != nil {
		e.T.Fatalf("contact picture = %+v, want none", p)
	}
}

// TestReceivedMessageFetchingPicture proves the ticket opened by a received
// message looks up the profile picture of the contact, stores the thumbnail
// and the full image and records the references, the provider id and the
// attempt (spec #482).
func TestReceivedMessageFetchingPicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	e.connectSector(contab.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()

	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, providerID)

	// The ticket and its message are intact: the picture added no message.
	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 || len(e.messages(tickets[0].ID)) != 1 {
		t.Fatalf("tickets = %+v, messages = %+v", tickets, e.messages(tickets[0].ID))
	}
}

// TestStartConversationFetchingPicture proves "Novo atendimento" also looks up
// the picture (spec #482).
func TestStartConversationFetchingPicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura de Santos", "")
	contactID := e.Contact(adminToken, "Carla Souza", "5513988881111", org, sector.ID)

	providerID := e.WhatsApp.SetProfilePicture("5513988881111@s.whatsapp.net")
	if _, err := e.Pool.Exec(e.T.Context(),
		"update contacts set external_contact_id = '5513988881111@s.whatsapp.net' where id = $1", contactID); err != nil {
		e.T.Fatal(err)
	}

	resp := e.startConversation(sector.ID, contactID, token, requestC, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	e.TicketService.Wait()

	e.wantPhotoStored(contactID, providerID)
}

// TestStartResolvesPhoneBeforePicture proves a contact without a provider id
// is resolved by its phone before the picture lookup (spec #482).
func TestStartResolvesPhoneBeforePicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura de Santos", "")
	contactID := e.Contact(adminToken, "Carla Souza", "5513988881111", org, sector.ID)

	// The fake resolves the phone to this provider contact id.
	providerID := e.WhatsApp.SetProfilePicture("5513988881111@fake")

	resp := e.startConversation(sector.ID, contactID, token, requestC, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	e.TicketService.Wait()

	e.wantPhotoStored(contactID, providerID)
}

// TestResolveWithoutWhatsAppLeavesTheContactWithoutPicture proves a phone
// without WhatsApp ends the lookup as "no picture", without failing the start
// and still counting the attempt (spec #482).
func TestResolveWithoutWhatsAppLeavesTheContactWithoutPicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura de Santos", "")
	contactID := e.Contact(adminToken, "Carla Souza", "5513988881111", org, sector.ID)

	// The phone has no account in the provider.
	e.WhatsApp.FailNextResolveContact(sector.ID, messaging.ErrContactNotFound)
	resp := e.startConversation(sector.ID, contactID, token, requestC, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	e.TicketService.Wait()

	e.wantNoPhoto(contactID)
	if p := e.contactPhoto(contactID); p.CheckedAt == nil {
		t.Fatal("the attempt was not recorded")
	}
	if got := e.Count("media_files"); got != 0 {
		t.Fatalf("media files = %d, want none", got)
	}
	if got := len(e.tickets(sector.ID)); got != 1 {
		t.Fatalf("tickets = %d, want the ticket created", got)
	}
}

// TestResolveFailureLeavesTheContactWithoutPicture proves a failure to resolve
// the phone changes nothing: no picture, no file, only the attempt; the start
// is not affected (spec #482).
func TestResolveFailureLeavesTheContactWithoutPicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura de Santos", "")
	contactID := e.Contact(adminToken, "Carla Souza", "5513988881111", org, sector.ID)

	e.WhatsApp.FailNextResolveContact(sector.ID, errors.New("provider unavailable"))
	resp := e.startConversation(sector.ID, contactID, token, requestC, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	e.TicketService.Wait()

	e.wantNoPhoto(contactID)
	if p := e.contactPhoto(contactID); p.CheckedAt == nil {
		t.Fatal("the attempt was not recorded")
	}
	if got := e.Count("media_files"); got != 0 {
		t.Fatalf("media files = %d, want none", got)
	}
	if got := len(e.tickets(sector.ID)); got != 1 {
		t.Fatalf("tickets = %d, want the ticket created", got)
	}
}

// TestContactWithoutPhoneIsSkipped proves a contact with neither a phone nor a
// provider id ends the lookup without error and without asking the provider;
// only the attempt is recorded (spec #482). The API does not create a contact
// in that state, so the row is inserted directly.
func TestContactWithoutPhoneIsSkipped(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)

	var contactID int64
	if err := e.Pool.QueryRow(e.T.Context(),
		"insert into contacts (name) values ('Sem telefone') returning id").Scan(&contactID); err != nil {
		t.Fatal(err)
	}
	// Both provider calls fail if reached: finishing without error proves
	// neither one ran.
	e.WhatsApp.FailNextResolveContact(sector.ID, errors.New("resolve must not run"))
	e.WhatsApp.FailNextProfilePicture(sector.ID, errors.New("picture must not run"))

	if err := helpdesk.LookupContactPhoto(e.TicketService, t.Context(), sector.ID, contactID); err != nil {
		t.Fatalf("lookup: %v", err)
	}
	e.wantNoPhoto(contactID)
	if p := e.contactPhoto(contactID); p.CheckedAt == nil {
		t.Fatal("the attempt was not recorded")
	}
	if got := e.Count("media_files"); got != 0 {
		t.Fatalf("media files = %d, want none", got)
	}
}

// TestPictureLookupAtMostOncePerDay proves a second ticket of the same contact
// before 24 hours does not ask the provider again, even after the picture
// changed; and a message entering an open ticket does not look it up either
// (spec #482).
func TestPictureLookupAtMostOncePerDay(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	first := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, first)

	// A new picture and less than 24 hours: neither a new ticket in another
	// sector nor a message in the open ticket may look it up again.
	second := e.WhatsApp.SetProfilePicture(contact)
	if second == first {
		t.Fatal("the fake reused the picture id")
	}
	e.receive(rh.ID, text("MSG-2", contact, phone, "Bom dia de novo"))
	e.receive(contab.ID, text("MSG-3", contact, phone, "Ainda aí?"))
	e.TicketService.Wait()

	if p := e.contactPhoto(contactID); p.ExternalID == nil || *p.ExternalID != first {
		t.Fatalf("picture id = %v, want the first %q", p.ExternalID, first)
	}
	if e.Count("media_files") != 2 {
		t.Fatalf("media files = %d, want the 2 of the first picture", e.Count("media_files"))
	}
}

// TestPictureUnchangedKeepsTheStoredOne proves a lookup the provider reports
// as unchanged keeps the stored picture and its files and only counts the new
// attempt (spec #482).
func TestPictureUnchangedKeepsTheStoredOne(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, providerID)
	stored := e.contactPhoto(contactID)
	before := *stored.CheckedAt

	// The same picture, with the interval over: the provider says unchanged.
	e.backdatePhotoCheck(contactID)
	e.receive(rh.ID, text("MSG-2", contact, phone, "Bom dia de novo"))
	e.TicketService.Wait()

	kept := e.contactPhoto(contactID)
	if kept.ExternalID == nil || *kept.ExternalID != providerID {
		t.Fatalf("picture id = %v, want %q", kept.ExternalID, providerID)
	}
	if kept.MediaID == nil || *kept.MediaID != *stored.MediaID ||
		kept.ThumbnailMediaID == nil || *kept.ThumbnailMediaID != *stored.ThumbnailMediaID {
		t.Fatalf("picture files = %v/%v, want the stored ones", kept.MediaID, kept.ThumbnailMediaID)
	}
	if kept.CheckedAt == nil || !kept.CheckedAt.After(before) {
		t.Fatalf("attempt = %v, want it advanced", kept.CheckedAt)
	}
	if got := e.Count("media_files"); got != 2 {
		t.Fatalf("media files = %d, want the 2 of the stored picture", got)
	}
}

// TestPictureNoneClearsThePhoto proves a lookup without a picture clears the
// three references and deletes the files, with the ticket untouched
// (spec #482).
func TestPictureNoneClearsThePhoto(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	old := e.contactPhoto(contactID)
	e.wantPhotoStored(contactID, providerID)
	keys := []string{e.media(*old.MediaID).StorageKey, e.media(*old.ThumbnailMediaID).StorageKey}

	e.WhatsApp.ClearProfilePicture(contact)
	e.backdatePhotoCheck(contactID)
	e.receive(rh.ID, text("MSG-2", contact, phone, "Bom dia de novo"))
	e.TicketService.Wait()

	e.wantNoPhoto(contactID)
	if p := e.contactPhoto(contactID); p.CheckedAt == nil {
		t.Fatal("the attempt was not recorded")
	}
	if got := e.Count("media_files"); got != 0 {
		t.Fatalf("media files = %d, want the old picture files removed", got)
	}
	for _, key := range keys {
		if _, err := e.Files.Open(e.T.Context(), key); !errors.Is(err, storage.ErrNotFound) {
			t.Fatalf("old file %s = %v, want it removed", key, err)
		}
	}
	if got := len(e.tickets(rh.ID)); got != 1 {
		t.Fatalf("tickets in the second sector = %d, want the ticket created", got)
	}
}

// TestPictureFailureKeepsThePreviousOne proves a failed lookup keeps the
// previous picture, records the attempt and does not block the ticket; the
// next lookup waits for the 24 hours (spec #482).
func TestPictureFailureKeepsThePreviousOne(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	before := *e.contactPhoto(contactID).CheckedAt

	// The provider fails the next lookup of the sector: the picture stays.
	e.WhatsApp.FailNextProfilePicture(rh.ID, fake.ErrProfilePictureUnreachable)
	e.backdatePhotoCheck(contactID)
	e.receive(rh.ID, text("MSG-2", contact, phone, "Bom dia de novo"))
	e.TicketService.Wait()

	e.wantPhotoStored(contactID, providerID)
	after := e.contactPhoto(contactID).CheckedAt
	if after == nil || !after.After(before) {
		t.Fatalf("attempt = %v, want it advanced after the failure", after)
	}
	if got := len(e.tickets(rh.ID)); got != 1 {
		t.Fatalf("tickets in the second sector = %d, want the ticket created", got)
	}
}

// TestReceiveOverHTTPWithPictureFailureStays2xx proves the receive route of
// the fake still answers 2xx when the picture lookup fails: the failure never
// reaches the route (spec #482).
func TestReceiveOverHTTPWithPictureFailureStays2xx(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, providerID)

	// The next lookup fails, in a ticket opened through the HTTP route.
	e.WhatsApp.FailNextProfilePicture(rh.ID, fake.ErrProfilePictureUnreachable)
	e.backdatePhotoCheck(contactID)
	body := fmt.Sprintf(`{"externalMessageId":"MSG-HTTP","phone":%q,"body":"Bom dia de novo"}`, phone)
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost,
		fmt.Sprintf("/messaging/sectors/%d/receive", rh.ID), strings.NewReader(body))
	rec := httptest.NewRecorder()
	e.WhatsApp.Handler().ServeHTTP(rec, req)
	if rec.Code < 200 || rec.Code >= 300 {
		t.Fatalf("receive = %d %s, want 2xx", rec.Code, rec.Body)
	}
	e.TicketService.Wait()

	e.wantPhotoStored(contactID, providerID)
	tickets := e.tickets(rh.ID)
	if len(tickets) != 1 || len(e.messages(tickets[0].ID)) != 1 {
		t.Fatalf("tickets = %+v, messages = %+v", tickets, e.messages(tickets[0].ID))
	}
}

// TestPictureDownloadFailureKeepsThePreviousOne proves a download that is not
// an image, or fails, keeps the previous picture (spec #482).
func TestPictureDownloadFailureKeepsThePreviousOne(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.connectSector(contab.ID)
	e.connectSector(rh.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	providerID := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, providerID)

	// A new picture whose link answers with a page, not an image.
	e.WhatsApp.SetProfilePicture(contact)
	notImage := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		_, _ = w.Write([]byte("<html>not a picture</html>"))
	}))
	e.T.Cleanup(notImage.Close)
	e.WhatsApp.SetProfilePictureBaseURL(notImage.URL)

	e.backdatePhotoCheck(contactID)
	e.receive(rh.ID, text("MSG-2", contact, phone, "Bom dia de novo"))
	e.TicketService.Wait()

	e.wantPhotoStored(contactID, providerID)
}

// TestPictureLookupDoesNotDelayTheTicket proves the lookup runs after the
// commit, in the background: the start answers before the download ends
// (spec #482).
func TestPictureLookupDoesNotDelayTheTicket(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.connectSector(sector.ID)
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("ana@exemplo.com", testPassword)
	adminToken := e.Login("admin@exemplo.com", testPassword)
	org := e.Organization(adminToken, "Prefeitura de Santos", "")
	contactID := e.Contact(adminToken, "Carla Souza", "5513988881111", org, sector.ID)
	e.WhatsApp.SetProfilePicture("5513988881111@s.whatsapp.net")

	// The provider link holds the download until the test releases it.
	release := make(chan struct{})
	var once sync.Once
	unblock := func() { once.Do(func() { close(release) }) }
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		<-release
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write([]byte("\x89PNG\r\n\x1a\n"))
	}))
	e.T.Cleanup(srv.Close)
	// Registered last, so it runs before the server closes on a failure.
	e.T.Cleanup(unblock)
	e.WhatsApp.SetProfilePictureBaseURL(srv.URL)

	started := make(chan response, 1)
	go func() {
		started <- e.startConversation(sector.ID, contactID, token, requestC, "Bom dia, Carla.")
	}()
	select {
	case resp := <-started:
		if resp.Status != http.StatusCreated {
			t.Errorf("start: status %d, body %v", resp.Status, resp.Body)
		}
	case <-time.After(10 * time.Second):
		unblock()
		t.Fatal("the start waited for the picture download")
	}
	unblock()
	e.TicketService.Wait()
}

// TestMessageInOpenTicketDoesNotFetchPicture proves a message that enters an
// already open ticket does not look up the picture, even after the interval
// (spec #482).
func TestMessageInOpenTicketDoesNotFetchPicture(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.serveProfilePictures()
	contab := e.Sector("Contabilidade")
	e.connectSector(contab.ID)

	const phone = "5511988887777"
	contact := phone + "@s.whatsapp.net"
	first := e.WhatsApp.SetProfilePicture(contact)

	e.receive(contab.ID, text("MSG-1", contact, phone, "Bom dia"))
	e.TicketService.Wait()
	contactID := e.contactIDByPhone(phone)
	e.wantPhotoStored(contactID, first)

	e.WhatsApp.SetProfilePicture(contact)
	e.backdatePhotoCheck(contactID)
	e.receive(contab.ID, text("MSG-2", contact, phone, "Ainda aí?"))
	e.TicketService.Wait()

	if p := e.contactPhoto(contactID); p.ExternalID == nil || *p.ExternalID != first {
		t.Fatalf("picture id = %v, want %q", p.ExternalID, first)
	}
	if got := len(e.messages(e.tickets(contab.ID)[0].ID)); got != 2 {
		t.Fatalf("messages = %d, want 2", got)
	}
}
