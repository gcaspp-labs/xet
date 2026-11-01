package httpapi

import (
	"fmt"
	"io"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/messaging"
)

type ticketRow struct {
	ID             int64
	Protocol       string
	Status         string
	ContactID      int64
	OrganizationID *int64
	ArrivedAt      time.Time
	StartedAt      time.Time
}

type messageRow struct {
	ID                int64
	ContactID         int64
	Direction         string
	Origin            string
	AuthorID          *int64
	Type              string
	Body              *string
	MediaID           *int64
	ExternalMessageID *string
	Status            *string
	SentAt            time.Time
}

type contactRow struct {
	ID                int64
	Name              string
	Phone             *string
	ExternalContactID *string
	OrganizationID    *int64
	Registered        bool
}

type mediaRow struct {
	StorageKey      string
	MimeType        string
	SizeBytes       int64
	FileName        *string
	Sha256          string
	DurationSeconds *int32
}

func (e *testEnv) receive(sectorID int64, msg messaging.Message) {
	e.t.Helper()
	if err := e.whatsapp.Receive(e.t.Context(), sectorID, msg); err != nil {
		e.t.Fatalf("receive %s: %v", msg.ExternalMessageID, err)
	}
}

func (e *testEnv) sendOutside(sectorID int64, msg messaging.Message) {
	e.t.Helper()
	if err := e.whatsapp.SendOutside(e.t.Context(), sectorID, msg); err != nil {
		e.t.Fatalf("send outside %s: %v", msg.ExternalMessageID, err)
	}
}

// tickets lists the tickets of the sector in creation order.
func (e *testEnv) tickets(sectorID int64) []ticketRow {
	e.t.Helper()
	rows, _ := e.pool.Query(e.t.Context(), `
		select id, protocol, status::text, contact_id, organization_id, arrived_at, started_at
		from tickets where sector_id = $1 order by id`, sectorID)
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (ticketRow, error) {
		var t ticketRow
		err := r.Scan(&t.ID, &t.Protocol, &t.Status, &t.ContactID, &t.OrganizationID, &t.ArrivedAt, &t.StartedAt)
		return t, err
	})
	if err != nil {
		e.t.Fatal(err)
	}
	return out
}

// messages lists the messages of the ticket in the order they were sent.
func (e *testEnv) messages(ticketID int64) []messageRow {
	e.t.Helper()
	rows, _ := e.pool.Query(e.t.Context(), `
		select id, contact_id, direction::text, origin::text, author_id, type::text, body, media_id,
		       external_message_id, status::text, sent_at
		from messages where ticket_id = $1 order by sent_at, id`, ticketID)
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (messageRow, error) {
		var m messageRow
		err := r.Scan(&m.ID, &m.ContactID, &m.Direction, &m.Origin, &m.AuthorID, &m.Type, &m.Body, &m.MediaID,
			&m.ExternalMessageID, &m.Status, &m.SentAt)
		return m, err
	})
	if err != nil {
		e.t.Fatal(err)
	}
	return out
}

func (e *testEnv) contacts() []contactRow {
	e.t.Helper()
	rows, _ := e.pool.Query(e.t.Context(), `
		select id, name, phone, external_contact_id, organization_id, registered from contacts order by id`)
	out, err := pgx.CollectRows(rows, func(r pgx.CollectableRow) (contactRow, error) {
		var c contactRow
		err := r.Scan(&c.ID, &c.Name, &c.Phone, &c.ExternalContactID, &c.OrganizationID, &c.Registered)
		return c, err
	})
	if err != nil {
		e.t.Fatal(err)
	}
	return out
}

func (e *testEnv) media(id int64) mediaRow {
	e.t.Helper()
	var m mediaRow
	err := e.pool.QueryRow(e.t.Context(), `
		select storage_key, mime_type, size_bytes, file_name, sha256, duration_seconds
		from media_files where id = $1`, id).
		Scan(&m.StorageKey, &m.MimeType, &m.SizeBytes, &m.FileName, &m.Sha256, &m.DurationSeconds)
	if err != nil {
		e.t.Fatal(err)
	}
	return m
}

func (e *testEnv) count(table string) int {
	e.t.Helper()
	var n int
	if err := e.pool.QueryRow(e.t.Context(), "select count(*) from "+table).Scan(&n); err != nil {
		e.t.Fatal(err)
	}
	return n
}

// closeTicket closes the ticket directly in the database, standing in for
// the closing form (T13).
func (e *testEnv) closeTicket(ticketID, userID, orgID int64) {
	e.t.Helper()
	_, err := e.pool.Exec(e.t.Context(), `
		update tickets set status = 'closed', assignee_id = $2, organization_id = $3, ended_at = now(),
		       closed_at = now(), closed_by_id = $2, closure_type = 'resolved', subject = 'Dúvida', resolution = 'Resolvida'
		where id = $1`, ticketID, userID, orgID)
	if err != nil {
		e.t.Fatal(err)
	}
}

func text(id, contact, phone, body string) messaging.Message {
	return messaging.Message{
		ExternalMessageID: id,
		ExternalContactID: contact,
		Phone:             phone,
		Type:              messaging.TypeText,
		Body:              body,
		SentAt:            time.Now().Truncate(time.Microsecond),
	}
}

func protocol(n int) string {
	loc, _ := time.LoadLocation("America/Sao_Paulo")
	return fmt.Sprintf("%d-%06d", time.Now().In(loc).Year(), n)
}

func TestReceiveFromUnknownNumberOpensQueuedTicket(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	first := text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Bom dia, preciso de ajuda")
	first.ContactName = "Maria do Perfil"
	first.SentAt = time.Now().Add(-time.Minute).Truncate(time.Microsecond)
	e.receive(contab.ID, first)

	contacts := e.contacts()
	if len(contacts) != 1 {
		t.Fatalf("contacts = %d, want 1", len(contacts))
	}
	c := contacts[0]
	if c.Name != "Maria do Perfil" || c.Phone == nil || *c.Phone != "5511988887777" || c.Registered || c.OrganizationID != nil ||
		c.ExternalContactID == nil || *c.ExternalContactID != "5511988887777@s.whatsapp.net" {
		t.Fatalf("contact = %+v", c)
	}

	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 {
		t.Fatalf("tickets = %d, want 1", len(tickets))
	}
	tk := tickets[0]
	if tk.Status != "queued" || tk.Protocol != protocol(1) || tk.ContactID != c.ID || tk.OrganizationID != nil {
		t.Fatalf("ticket = %+v", tk)
	}
	if !tk.ArrivedAt.Equal(first.SentAt) || !tk.StartedAt.Equal(first.SentAt) {
		t.Fatalf("arrived_at = %v, started_at = %v, want %v", tk.ArrivedAt, tk.StartedAt, first.SentAt)
	}

	// A segunda mensagem entra no chamado aberto.
	e.receive(contab.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Alguém aí?"))
	if got := len(e.tickets(contab.ID)); got != 1 {
		t.Fatalf("tickets after second message = %d, want 1", got)
	}
	msgs := e.messages(tk.ID)
	if len(msgs) != 2 {
		t.Fatalf("messages = %d, want 2", len(msgs))
	}
	m := msgs[0]
	if m.Direction != "inbound" || m.Origin != "customer" || m.AuthorID != nil || m.Type != "text" ||
		m.Body == nil || *m.Body != "Bom dia, preciso de ajuda" || m.Status != nil || m.MediaID != nil ||
		m.ExternalMessageID == nil || *m.ExternalMessageID != "MSG-1" || !m.SentAt.Equal(first.SentAt) || m.ContactID != c.ID {
		t.Fatalf("first message = %+v", m)
	}

	// Outro contato abre o próximo protocolo.
	e.receive(contab.ID, text("MSG-3", "5511977776666@s.whatsapp.net", "5511977776666", "Olá"))
	tickets = e.tickets(contab.ID)
	if len(tickets) != 2 || tickets[1].Protocol != protocol(2) {
		t.Fatalf("tickets = %+v", tickets)
	}
	// Sem nome de perfil, o contato recebe o telefone como nome.
	if c := e.contacts()[1]; c.Name != "5511977776666" {
		t.Fatalf("contact without profile name = %+v", c)
	}
}

func TestProtocolSequenceIsSharedBySectors(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	rh := e.sector("RH")

	e.receive(contab.ID, text("A", "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
	// O mesmo contato tem um chamado aberto em cada setor.
	e.receive(rh.ID, text("B", "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
	// O mesmo identificador de mensagem em outro número é outra mensagem.
	e.receive(rh.ID, text("A", "5511977776666@s.whatsapp.net", "5511977776666", "Oi"))

	c, r := e.tickets(contab.ID), e.tickets(rh.ID)
	if len(c) != 1 || len(r) != 2 {
		t.Fatalf("tickets: contabilidade %d, rh %d", len(c), len(r))
	}
	if c[0].Protocol != protocol(1) || r[0].Protocol != protocol(2) || r[1].Protocol != protocol(3) {
		t.Fatalf("protocols = %s, %s, %s", c[0].Protocol, r[0].Protocol, r[1].Protocol)
	}
	if c[0].ContactID != r[0].ContactID || len(e.contacts()) != 2 {
		t.Fatalf("contacts = %+v", e.contacts())
	}
}

func TestRepeatedMessageIsRecordedOnce(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	msg := text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Oi")
	e.receive(contab.ID, msg)
	e.receive(contab.ID, msg)

	// Entregas simultâneas da mesma mensagem, de um contato novo, também não duplicam.
	again := text("MSG-2", "5511977776666@s.whatsapp.net", "5511977776666", "Olá")
	again.Type, again.Media = messaging.TypeImage, &messaging.Media{Data: []byte("imagem"), MimeType: "image/jpeg"}
	var wg sync.WaitGroup
	errs := make(chan error, 10)
	for range 10 {
		wg.Go(func() { errs <- e.whatsapp.Receive(t.Context(), contab.ID, again) })
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent receive: %v", err)
		}
	}

	if got := e.count("messages"); got != 2 {
		t.Fatalf("messages = %d, want 2", got)
	}
	if got := e.count("media_files"); got != 1 {
		t.Fatalf("media files = %d, want 1", got)
	}
	if got := len(e.tickets(contab.ID)); got != 2 {
		t.Fatalf("tickets = %d, want 2", got)
	}
	if got := len(e.contacts()); got != 2 {
		t.Fatalf("contacts = %d, want 2", got)
	}
}

func TestConcurrentMessagesOpenOneTicket(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	var wg sync.WaitGroup
	errs := make(chan error, 10)
	for i := range 10 {
		wg.Go(func() {
			errs <- e.whatsapp.Receive(t.Context(), contab.ID,
				text(fmt.Sprintf("MSG-%d", i), "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatalf("concurrent receive: %v", err)
		}
	}

	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 {
		t.Fatalf("tickets = %d, want 1", len(tickets))
	}
	if got := len(e.messages(tickets[0].ID)); got != 10 {
		t.Fatalf("messages = %d, want 10", got)
	}
	if got := len(e.contacts()); got != 1 {
		t.Fatalf("contacts = %d, want 1", got)
	}
}

func TestOneOpenTicketPerContactAndSectorInDatabase(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.receive(contab.ID, text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
	tk := e.tickets(contab.ID)[0]

	// O índice único recusa um segundo chamado aberto mesmo fora do serviço.
	_, err := e.pool.Exec(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2000-000001', $1, $2, 'queued', now(), now())`, contab.ID, tk.ContactID)
	if err == nil {
		t.Fatal("second open ticket was accepted")
	}
}

func TestMessageAfterClosingOpensNewTicket(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	agent := e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	org, err := e.q.CreateOrganization(t.Context(), db.CreateOrganizationParams{Name: "Prefeitura"})
	if err != nil {
		t.Fatal(err)
	}

	e.receive(contab.ID, text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
	first := e.tickets(contab.ID)[0]
	e.closeTicket(first.ID, agent.ID, org.ID)

	e.receive(contab.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outra dúvida"))
	tickets := e.tickets(contab.ID)
	if len(tickets) != 2 || tickets[0].Status != "closed" || tickets[1].Status != "queued" || tickets[1].Protocol != protocol(2) {
		t.Fatalf("tickets = %+v", tickets)
	}
	if got := len(e.messages(first.ID)); got != 1 {
		t.Fatalf("messages of the closed ticket = %d, want 1", got)
	}
	if got := len(e.messages(tickets[1].ID)); got != 1 {
		t.Fatalf("messages of the new ticket = %d, want 1", got)
	}
}

func TestGroupMessagesAreIgnored(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	e.receive(contab.ID, messaging.Message{ExternalMessageID: "GRP-1", Group: true, Type: messaging.TypeText, Body: "Oi, grupo", SentAt: time.Now()})
	e.sendOutside(contab.ID, messaging.Message{ExternalMessageID: "GRP-2", Group: true, Type: messaging.TypeText, Body: "Resposta no grupo", SentAt: time.Now()})

	if n := e.count("tickets") + e.count("messages") + e.count("contacts"); n != 0 {
		t.Fatalf("group messages left %d rows, want none", n)
	}
}

func TestRegisteredContactIsMatchedByPhoneVariant(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.login("sup@exemplo.com", testPassword)
	orgID := e.organization(token, "Câmara Municipal", "")
	// Cadastrado com o nono dígito; o WhatsApp informa o número sem ele.
	withNine := e.contact(token, "José Cadastrado", "5511987654321", orgID, contab.ID)
	// Cadastrado sem o nono dígito; o WhatsApp informa o número com ele.
	withoutNine := e.contact(token, "Ana Cadastrada", "551176543210", orgID, contab.ID)

	msg := text("MSG-1", "551187654321@s.whatsapp.net", "551187654321", "Oi")
	msg.ContactName = "Zé"
	e.receive(contab.ID, msg)
	e.receive(contab.ID, text("MSG-2", "5511976543210@s.whatsapp.net", "5511976543210", "Olá"))

	contacts := e.contacts()
	if len(contacts) != 2 {
		t.Fatalf("contacts = %+v, want only the two registered", contacts)
	}
	for _, c := range contacts {
		want := map[int64]string{withNine: "551187654321@s.whatsapp.net", withoutNine: "5511976543210@s.whatsapp.net"}[c.ID]
		if c.ExternalContactID == nil || *c.ExternalContactID != want || !c.Registered {
			t.Fatalf("contact %d = %+v, want external id %s", c.ID, c, want)
		}
	}
	if contacts[0].Name != "José Cadastrado" {
		t.Fatalf("registered name changed to %q", contacts[0].Name)
	}
	tickets := e.tickets(contab.ID)
	if len(tickets) != 2 || tickets[0].ContactID != withNine || tickets[1].ContactID != withoutNine {
		t.Fatalf("tickets = %+v", tickets)
	}
	// O órgão do chamado vem do órgão principal do contato.
	for _, tk := range tickets {
		if tk.OrganizationID == nil || *tk.OrganizationID != orgID {
			t.Fatalf("ticket organization = %v, want %d", tk.OrganizationID, orgID)
		}
	}

	// Depois do casamento, vale o identificador do WhatsApp, mesmo sem telefone.
	e.receive(contab.ID, text("MSG-3", "551187654321@s.whatsapp.net", "", "De novo"))
	if got := len(e.messages(tickets[0].ID)); got != 2 {
		t.Fatalf("messages of the matched contact = %d, want 2", got)
	}
}

func TestContactKnownOnlyByLID(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	e.receive(contab.ID, text("MSG-1", "123456789012345@lid", "", "Oi"))
	named := text("MSG-2", "999456789012345@lid", "", "Olá")
	named.ContactName = "Carla"
	e.receive(contab.ID, named)

	contacts := e.contacts()
	if len(contacts) != 2 {
		t.Fatalf("contacts = %d, want 2", len(contacts))
	}
	if c := contacts[0]; c.Phone != nil || c.Name != "Contato sem telefone" || c.Registered {
		t.Fatalf("contact without phone = %+v", c)
	}
	if c := contacts[1]; c.Phone != nil || c.Name != "Carla" {
		t.Fatalf("contact without phone, with profile name = %+v", c)
	}
	if got := len(e.tickets(contab.ID)); got != 2 {
		t.Fatalf("tickets = %d, want 2", got)
	}

	// A busca de contatos continua funcionando com contatos sem telefone.
	e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("ana@exemplo.com", testPassword)
	list := e.doList(http.MethodGet, "/api/contacts?q=carla", token)
	if len(list) != 1 || list[0]["phone"] != nil || list[0]["registered"] != false {
		t.Fatalf("contacts search = %v", list)
	}
}

func TestMessagesSentFromThePhone(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")

	// Sem chamado aberto, a mensagem do celular abre um chamado na fila.
	e.sendOutside(contab.ID, text("OUT-1", "5511988887777@s.whatsapp.net", "5511988887777", "Bom dia, aqui é da contabilidade"))
	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 || tickets[0].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	if c := e.contacts()[0]; c.Name != "5511988887777" || c.Registered {
		t.Fatalf("contact = %+v", c)
	}

	// Com chamado aberto, a resposta do cliente e a do celular entram nele.
	e.receive(contab.ID, text("IN-1", "5511988887777@s.whatsapp.net", "5511988887777", "Bom dia"))
	e.sendOutside(contab.ID, text("OUT-2", "5511988887777@s.whatsapp.net", "5511988887777", "Pode mandar o documento?"))
	e.sendOutside(contab.ID, text("OUT-2", "5511988887777@s.whatsapp.net", "5511988887777", "Pode mandar o documento?"))
	if got := len(e.tickets(contab.ID)); got != 1 {
		t.Fatalf("tickets = %d, want 1", got)
	}

	msgs := e.messages(tickets[0].ID)
	if len(msgs) != 3 {
		t.Fatalf("messages = %d, want 3", len(msgs))
	}
	for _, i := range []int{0, 2} {
		m := msgs[i]
		if m.Direction != "outbound" || m.Origin != "phone" || m.AuthorID != nil || m.Status == nil || *m.Status != "sent" {
			t.Fatalf("message from the phone = %+v", m)
		}
	}
	if m := msgs[1]; m.Direction != "inbound" || m.Origin != "customer" {
		t.Fatalf("message from the customer = %+v", m)
	}
}

func TestUnavailableMediaBecomesNotice(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	const contact, phone = "5511988887777@s.whatsapp.net", "5511988887777"

	// Abre o chamado mesmo sem o arquivo, e a reentrega não duplica o aviso.
	file := text("BIG-1", contact, phone, "video-grande.mp4")
	file.Type = messaging.TypeMediaUnavailable
	e.receive(contab.ID, file)
	e.receive(contab.ID, file)

	// Enviado pelo celular do setor, também fica registrado.
	outside := text("BIG-2", contact, phone, "")
	outside.Type = messaging.TypeMediaUnavailable
	e.sendOutside(contab.ID, outside)

	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 || tickets[0].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	msgs := e.messages(tickets[0].ID)
	if len(msgs) != 2 {
		t.Fatalf("messages = %d, want 2", len(msgs))
	}
	if m := msgs[0]; m.Type != "media_unavailable" || m.MediaID != nil || m.Direction != "inbound" ||
		m.Body == nil || *m.Body != "video-grande.mp4" {
		t.Fatalf("received notice = %+v", m)
	}
	if m := msgs[1]; m.Type != "media_unavailable" || m.MediaID != nil || m.Origin != "phone" || m.Body != nil {
		t.Fatalf("notice from the phone = %+v", m)
	}
	if got := e.count("media_files"); got != 0 {
		t.Fatalf("media files = %d, want 0", got)
	}

	// A restrição do banco recusa anexo no aviso, mesmo fora do serviço.
	doc := text("DOC-1", contact, phone, "")
	doc.Type = messaging.TypeDocument
	doc.Media = &messaging.Media{Data: []byte("%PDF"), MimeType: "application/pdf"}
	e.receive(contab.ID, doc)
	saved := e.messages(tickets[0].ID)[2]
	if _, err := e.pool.Exec(t.Context(), `update messages set media_id = $1 where id = $2`, saved.MediaID, msgs[0].ID); err == nil {
		t.Fatal("notice with a file was accepted")
	}
}

func TestMediaIsSavedOnArrival(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade")
	const contact, phone = "5511988887777@s.whatsapp.net", "5511988887777"

	doc := text("DOC-1", contact, phone, "Segue a nota")
	doc.Type = messaging.TypeDocument
	doc.Media = &messaging.Media{Data: []byte("%PDF-1.7 conteúdo"), MimeType: "application/pdf", FileName: "nota.pdf"}
	e.receive(contab.ID, doc)

	audio := text("AUD-1", contact, phone, "")
	audio.Type = messaging.TypeAudio
	audio.Media = &messaging.Media{Data: []byte("OggS áudio"), MimeType: "audio/ogg; codecs=opus", DurationSeconds: 7}
	e.receive(contab.ID, audio)

	for _, typ := range []messaging.MessageType{messaging.TypeImage, messaging.TypeVideo} {
		m := text("MEDIA-"+string(typ), contact, phone, "")
		m.Type = typ
		m.Media = &messaging.Media{Data: []byte("bytes de " + string(typ)), MimeType: string(typ) + "/x-test"}
		e.receive(contab.ID, m)
	}

	// Tipo não suportado fica registrado como aviso, sem anexo.
	sticker := text("STK-1", contact, phone, "")
	sticker.Type = messaging.TypeUnsupported
	e.receive(contab.ID, sticker)

	msgs := e.messages(e.tickets(contab.ID)[0].ID)
	if len(msgs) != 5 {
		t.Fatalf("messages = %d, want 5", len(msgs))
	}

	if m := msgs[0]; m.Type != "document" || m.Body == nil || *m.Body != "Segue a nota" || m.MediaID == nil {
		t.Fatalf("document message = %+v", m)
	}
	pdf := e.media(*msgs[0].MediaID)
	if pdf.MimeType != "application/pdf" || pdf.FileName == nil || *pdf.FileName != "nota.pdf" ||
		pdf.SizeBytes != int64(len(doc.Media.Data)) || pdf.Sha256 == "" {
		t.Fatalf("document file = %+v", pdf)
	}
	f, err := e.files.Open(t.Context(), pdf.StorageKey)
	if err != nil {
		t.Fatal(err)
	}
	saved, _ := io.ReadAll(f)
	_ = f.Close()
	if string(saved) != string(doc.Media.Data) {
		t.Fatalf("saved file = %q, want %q", saved, doc.Media.Data)
	}

	if m := msgs[1]; m.Type != "audio" || m.Body != nil || m.MediaID == nil {
		t.Fatalf("audio message = %+v", m)
	}
	if a := e.media(*msgs[1].MediaID); a.DurationSeconds == nil || *a.DurationSeconds != 7 || a.StorageKey == pdf.StorageKey {
		t.Fatalf("audio file = %+v", a)
	}
	if msgs[2].Type != "image" || msgs[3].Type != "video" || msgs[2].MediaID == nil || msgs[3].MediaID == nil {
		t.Fatalf("image and video = %+v, %+v", msgs[2], msgs[3])
	}
	if m := msgs[4]; m.Type != "unsupported" || m.MediaID != nil {
		t.Fatalf("unsupported message = %+v", m)
	}
}

// contactSectors lists the sectors linked to the contact.
func (e *testEnv) contactSectors(contactID int64) []int64 {
	e.t.Helper()
	rows, err := e.pool.Query(e.t.Context(), `select sector_id from contact_sectors where contact_id = $1 order by sector_id`, contactID)
	if err != nil {
		e.t.Fatal(err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[int64])
	if err != nil {
		e.t.Fatal(err)
	}
	return ids
}

// O contato entra no setor ao escrever para o número dele e por mensagem do
// celular do setor, sem duplicar o vínculo nem perder os outros setores.
func TestMessagesLinkTheContactToTheSector(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")

	e.receive(contab.ID, text("MSG-1", "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
	e.receive(contab.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "De novo"))
	maria := e.contacts()[0].ID
	if got := e.contactSectors(maria); fmt.Sprint(got) != fmt.Sprint([]int64{contab.ID}) {
		t.Fatalf("after two messages: %v", got)
	}
	e.receive(rh.ID, text("MSG-3", "5511988887777@s.whatsapp.net", "5511988887777", "Oi, RH"))
	if got := e.contactSectors(maria); fmt.Sprint(got) != fmt.Sprint([]int64{contab.ID, rh.ID}) {
		t.Fatalf("after message to another sector: %v", got)
	}

	e.sendOutside(rh.ID, text("OUT-1", "5511977776666@s.whatsapp.net", "5511977776666", "Enviada pelo celular"))
	var joao int64
	for _, c := range e.contacts() {
		if c.ID != maria {
			joao = c.ID
		}
	}
	if got := e.contactSectors(joao); fmt.Sprint(got) != fmt.Sprint([]int64{rh.ID}) {
		t.Fatalf("after message from the phone: %v", got)
	}
}

// Mensagens do mesmo contato ao mesmo tempo que o cadastro dele: nenhum dos
// lados espera o outro para sempre e os vínculos terminam corretos.
func TestMessagesWhileSavingContactDoNotDeadlock(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab, rh := e.sector("Contabilidade"), e.sector("RH")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	admin := e.login("admin@exemplo.com", testPassword)
	org := e.organization(admin, "Prefeitura", "")
	contact := e.contact(admin, "Maria", "5511988887777", org, contab.ID)

	var wg sync.WaitGroup
	for i := range 8 {
		wg.Go(func() {
			e.receive(rh.ID, text(fmt.Sprintf("MSG-%d", i), "5511988887777@s.whatsapp.net", "5511988887777", "Oi"))
		})
		wg.Go(func() {
			resp := e.do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", contact), admin,
				map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": org, "sectorIds": []int64{contab.ID}})
			if resp.status != http.StatusOK {
				t.Errorf("update contact: status %d, body %v", resp.status, resp.body)
			}
		})
	}
	wg.Wait()
	if got := e.contactSectors(contact); !slices.Contains(got, contab.ID) {
		t.Fatalf("sectors: %v", got)
	}
}
