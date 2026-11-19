package helpdesk_test

import (
	"fmt"
	"net/http"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	changeContact = reactionContact
	changePhone   = "5511988887777"
)

// edit delivers an edit made by the contact.
func (e *testEnv) edit(sectorID int64, eventID, target, body string, at time.Time) {
	e.T.Helper()
	e.editAs(sectorID, messaging.MessageEdited{
		ExternalEventID: eventID, TargetExternalMessageID: target,
		ExternalContactID: changeContact, Phone: changePhone, Body: body, At: at,
	})
}

// editFromPhone delivers an edit made from the phone of the sector.
func (e *testEnv) editFromPhone(sectorID int64, eventID, target, body string, at time.Time) {
	e.T.Helper()
	e.editAs(sectorID, messaging.MessageEdited{
		ExternalEventID: eventID, TargetExternalMessageID: target,
		ExternalContactID: changeContact, Phone: changePhone, FromSector: true, Body: body, At: at,
	})
}

func (e *testEnv) editAs(sectorID int64, ev messaging.MessageEdited) {
	e.T.Helper()
	if err := e.WhatsApp.Edit(e.T.Context(), sectorID, ev); err != nil {
		e.T.Fatalf("edit %s: %v", ev.TargetExternalMessageID, err)
	}
}

// revoke delivers a deletion for everyone, by the contact or from the phone.
func (e *testEnv) revoke(sectorID int64, eventID, target string, fromSector bool, at time.Time) {
	e.T.Helper()
	ev := messaging.MessageRevoked{
		ExternalEventID: eventID, TargetExternalMessageID: target,
		ExternalContactID: changeContact, Phone: changePhone, FromSector: fromSector, At: at,
	}
	if err := e.WhatsApp.Revoke(e.T.Context(), sectorID, ev); err != nil {
		e.T.Fatalf("revoke %s: %v", target, err)
	}
}

// apiMessage returns the message with the provider ID as the messages API of
// the ticket shows it.
func (e *testEnv) apiMessage(ticketID int64, token, externalID string) map[string]any {
	e.T.Helper()
	id := e.messageID(ticketID, externalID)
	for _, m := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token) {
		if m["id"] == float64(id) {
			return m
		}
	}
	e.T.Fatalf("message %s not in the API", externalID)
	return nil
}

type version struct {
	Kind   string
	Origin string
	Body   string
	At     time.Time
}

// changesOf lists the recorded versions and deletions of the message, in order.
func (e *testEnv) changesOf(messageID int64) []version {
	e.T.Helper()
	rows, err := e.Q.ListMessageChanges(e.T.Context(), &messageID)
	if err != nil {
		e.T.Fatal(err)
	}
	out := make([]version, len(rows))
	for i, r := range rows {
		out[i] = version{Kind: string(r.Kind), Origin: string(r.Origin), At: r.OccurredAt}
		if r.Body != nil {
			out[i].Body = *r.Body
		}
	}
	return out
}

func bodyOf(t *testing.T, m map[string]any) string {
	t.Helper()
	b, ok := m["body"].(string)
	if !ok {
		t.Fatalf("message without body: %v", m)
	}
	return b
}

func deletionOf(t *testing.T, m map[string]any) map[string]any {
	t.Helper()
	d, ok := m["deletion"].(map[string]any)
	if !ok {
		t.Fatalf("message not deleted: %v", m)
	}
	return d
}

// O cliente edita duas vezes: a mensagem é a mesma, mostra a versão atual e
// guarda a original e cada versão, com horário e origem.
func TestExternalEditKeepsTheOriginalAndEveryVersion(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	original := c.messages(c.ticket.ID)[0]
	t1 := original.SentAt.Add(time.Minute)
	t2 := t1.Add(time.Minute)

	c.edit(c.sector.ID, "EV-1", "IN-1", "Olá", t1)
	c.edit(c.sector.ID, "EV-2", "IN-1", "Olá, tudo bem?", t2)

	got := c.apiMessage(c.ticket.ID, c.token, "IN-1")
	if got["id"] != float64(original.ID) || bodyOf(t, got) != "Olá, tudo bem?" || got["deletion"] != nil {
		t.Fatalf("message = %v", got)
	}
	if at, _ := time.Parse(time.RFC3339Nano, got["editedAt"].(string)); !at.Equal(t2) {
		t.Fatalf("editedAt = %v, want %v", got["editedAt"], t2)
	}
	want := []version{
		{Kind: "original", Origin: "customer", Body: "Oi", At: original.SentAt},
		{Kind: "edit", Origin: "customer", Body: "Olá", At: t1},
		{Kind: "edit", Origin: "customer", Body: "Olá, tudo bem?", At: t2},
	}
	if got := c.changesOf(original.ID); !versionsEqual(got, want) {
		t.Fatalf("versions = %+v\nwant %+v", got, want)
	}
	// Não é mensagem nova nem chamado novo.
	if n := len(c.messages(c.ticket.ID)); n != 2 {
		t.Fatalf("messages = %d, want 2", n)
	}
	if n := len(c.tickets(c.sector.ID)); n != 1 {
		t.Fatalf("tickets = %d, want 1", n)
	}
}

// A legenda editada pelo celular troca o texto, nunca o arquivo, quem enviou nem o horário.
func TestEditFromThePhoneKeepsFileAuthorAndTime(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	photo := messaging.Message{
		ExternalMessageID: "OUT-IMG", ExternalContactID: changeContact, Phone: changePhone,
		Type: messaging.TypeImage, Body: "Segue o boleto", SentAt: time.Now().Truncate(time.Microsecond),
		Media: &messaging.Media{Data: []byte("png"), MimeType: "image/png"},
	}
	c.sendOutside(c.sector.ID, photo)
	before := c.messages(c.ticket.ID)[2]

	c.editFromPhone(c.sector.ID, "EV-IMG", "OUT-IMG", "Segue o boleto corrigido", photo.SentAt.Add(time.Minute))

	after := c.messages(c.ticket.ID)[2]
	if *after.Body != "Segue o boleto corrigido" {
		t.Fatalf("body = %q", *after.Body)
	}
	after.Body = before.Body
	if !reflect.DeepEqual(before, after) {
		t.Fatalf("message changed beyond the caption:\nbefore %+v\nafter  %+v", before, after)
	}
	got := c.changesOf(before.ID)
	if len(got) != 2 || got[0].Body != "Segue o boleto" || got[0].Origin != "phone" || got[1].Origin != "phone" {
		t.Fatalf("versions = %+v", got)
	}
}

// Reentrega, eco e o mesmo evento sem identificador não gravam outra versão
// nem avisam o painel de novo.
func TestRedeliveredAndEchoedChangesAreIdempotent(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	id := c.messageID(c.ticket.ID, "OUT-1")
	at := time.Now().Truncate(time.Microsecond).Add(time.Minute)
	events := c.subscribe(c.token)

	c.editFromPhone(c.sector.ID, "EV-1", "OUT-1", "Bom dia!", at)
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	// Reentrega ou eco do mesmo evento, mesmo com outro conteúdo ou horário.
	c.editFromPhone(c.sector.ID, "EV-1", "OUT-1", "Bom dia!", at)
	c.editFromPhone(c.sector.ID, "EV-1", "OUT-1", "outra coisa", at.Add(time.Hour))
	// Sem identificador do evento, o mesmo horário e conteúdo duas vezes.
	c.editFromPhone(c.sector.ID, "", "OUT-1", "Bom dia!!", at.Add(2*time.Second))
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	c.editFromPhone(c.sector.ID, "", "OUT-1", "Bom dia!!", at.Add(2*time.Second))
	// Exclusão repetida, com e sem identificador.
	c.revoke(c.sector.ID, "RV-1", "OUT-1", true, at.Add(3*time.Second))
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	c.revoke(c.sector.ID, "RV-1", "OUT-1", true, at.Add(3*time.Second))
	c.revoke(c.sector.ID, "", "OUT-1", true, at.Add(4*time.Second))

	got := c.changesOf(id)
	if len(got) != 4 || got[1].Body != "Bom dia!" || got[2].Body != "Bom dia!!" || got[3].Kind != "deletion" {
		t.Fatalf("changes = %+v", got)
	}
	if n := c.Count("message_changes"); n != 4 {
		t.Fatalf("message_changes = %d, want 4", n)
	}
	m := c.apiMessage(c.ticket.ID, c.token, "OUT-1")
	if bodyOf(t, m) != "Bom dia!!" {
		t.Fatalf("body = %v", m["body"])
	}
	c.noMoreEvents(events)
}

// Uma edição atrasada fica no histórico, mas não desfaz a versão mais nova.
func TestLateEditDoesNotUndoTheCurrentVersion(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	sent := c.messages(c.ticket.ID)[0].SentAt
	t1, t2 := sent.Add(time.Minute), sent.Add(2*time.Minute)

	c.edit(c.sector.ID, "EV-2", "IN-1", "segunda", t2)
	c.edit(c.sector.ID, "EV-1", "IN-1", "primeira", t1)

	m := c.apiMessage(c.ticket.ID, c.token, "IN-1")
	if bodyOf(t, m) != "segunda" {
		t.Fatalf("body = %v, want the newest version", m["body"])
	}
	got := c.changesOf(c.messageID(c.ticket.ID, "IN-1"))
	if len(got) != 3 || got[0].Body != "Oi" || got[1].Body != "primeira" || got[2].Body != "segunda" {
		t.Fatalf("versions = %+v", got)
	}
}

// A exclusão é um estado à parte: o conteúdo, o arquivo e a situação de
// entrega ficam como estavam.
func TestExternalDeletionKeepsContentFileAndDeliveryStatus(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	doc := messaging.Message{
		ExternalMessageID: "IN-DOC", ExternalContactID: changeContact, Phone: changePhone,
		Type: messaging.TypeDocument, Body: "Contrato", SentAt: time.Now().Truncate(time.Microsecond),
		Media: &messaging.Media{Data: []byte("%PDF"), MimeType: "application/pdf", FileName: "contrato.pdf"},
	}
	c.receive(c.sector.ID, doc)
	at := doc.SentAt.Add(time.Minute)

	c.revoke(c.sector.ID, "RV-DOC", "IN-DOC", false, at)
	c.revoke(c.sector.ID, "RV-OUT", "OUT-1", true, at)

	in := c.apiMessage(c.ticket.ID, c.token, "IN-DOC")
	if bodyOf(t, in) != "Contrato" || in["media"] == nil {
		t.Fatalf("content not kept: %v", in)
	}
	d := deletionOf(t, in)
	if d["scope"] != "everyone" || d["origin"] != "customer" {
		t.Fatalf("deletion = %v", d)
	}
	media := in["media"].(map[string]any)
	if status, _, body := c.get(fmt.Sprintf("/api/media/%d", int64(media["id"].(float64))), c.token); status != http.StatusOK || string(body) != "%PDF" {
		t.Fatalf("file = %d %q", status, body)
	}
	out := c.apiMessage(c.ticket.ID, c.token, "OUT-1")
	if bodyOf(t, out) != "Bom dia" || out["status"] != "sent" || deletionOf(t, out)["origin"] != "phone" {
		t.Fatalf("message from the phone = %v", out)
	}
}

// Alterações que chegam antes da mensagem esperam, sem criar chamado nem
// mensagem, e ficam ligadas a ela quando ela chega.
func TestChangesReceivedBeforeTheOriginalAreLinkedWhenItArrives(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	sent := time.Now().Truncate(time.Microsecond)

	c.edit(c.sector.ID, "EV-9", "IN-9", "corrigido", sent.Add(time.Minute))
	c.revoke(c.sector.ID, "RV-9", "IN-9", false, sent.Add(2*time.Minute))
	// De outro contato, para a mesma mensagem: nunca é ligada.
	c.editAs(c.sector.ID, messaging.MessageEdited{
		ExternalEventID: "EV-X", TargetExternalMessageID: "IN-9",
		ExternalContactID: "5511900001111@s.whatsapp.net", Phone: "5511900001111", Body: "intruso", At: sent.Add(3 * time.Minute),
	})
	if n := len(c.messages(c.ticket.ID)); n != 2 {
		t.Fatalf("messages = %d, want 2", n)
	}
	if n := len(c.tickets(c.sector.ID)); n != 1 {
		t.Fatalf("tickets = %d, want 1", n)
	}

	msg := text("IN-9", changeContact, changePhone, "original")
	msg.SentAt = sent
	c.receive(c.sector.ID, msg)

	m := c.apiMessage(c.ticket.ID, c.token, "IN-9")
	if bodyOf(t, m) != "corrigido" || deletionOf(t, m)["origin"] != "customer" {
		t.Fatalf("message = %v", m)
	}
	want := []version{
		{Kind: "original", Origin: "customer", Body: "original", At: sent},
		{Kind: "edit", Origin: "customer", Body: "corrigido", At: sent.Add(time.Minute)},
		{Kind: "deletion", Origin: "customer", At: sent.Add(2 * time.Minute)},
	}
	if got := c.changesOf(c.messageID(c.ticket.ID, "IN-9")); !versionsEqual(got, want) {
		t.Fatalf("changes = %+v\nwant %+v", got, want)
	}
	var unlinked int
	if err := c.Pool.QueryRow(t.Context(), "select count(*) from message_changes where message_id is null").Scan(&unlinked); err != nil || unlinked != 1 {
		t.Fatalf("unlinked = %d (%v), want only the other contact's", unlinked, err)
	}
}

// Edição pelo celular de uma mensagem enviada pelo XET que chega antes de o
// envio ser gravado fica ligada quando ele é gravado.
func TestPhoneEditBeforeTheSystemSendIsRecordedIsLinked(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	c.connectSector(c.sector.ID)
	if r := c.assign(c.ticket.ID, c.token); r.Status != http.StatusOK {
		t.Fatalf("assign = %d %s", r.Status, r.Body)
	}
	const request = "3f1e2d4c-5b6a-4789-8abc-0d1e2f3a4b5c"
	at := time.Now().Add(time.Minute).Truncate(time.Microsecond)
	c.editFromPhone(c.sector.ID, "EV-S", "fake-msg-"+request, "Ana Souza: corrigido", at)

	if r := c.sendText(c.ticket.ID, c.token, request, "texto"); r.Status != http.StatusCreated && r.Status != http.StatusOK {
		t.Fatalf("send = %d %s", r.Status, r.Body)
	}
	m := c.apiMessage(c.ticket.ID, c.token, "fake-msg-"+request)
	if bodyOf(t, m) != "Ana Souza: corrigido" || m["author"] == nil {
		t.Fatalf("message = %v", m)
	}
	got := c.changesOf(c.messageID(c.ticket.ID, "fake-msg-"+request))
	if len(got) != 2 || got[0].Kind != "original" || got[0].Origin != "agent" || got[1].Origin != "phone" {
		t.Fatalf("changes = %+v", got)
	}
}

// A alteração de mensagem de chamado encerrado é gravada no próprio chamado,
// sem abrir outro.
func TestChangesApplyToClosedTickets(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	c.closeFixtureTicket()
	at := time.Now().Truncate(time.Microsecond).Add(time.Minute)

	c.edit(c.sector.ID, "EV-1", "IN-1", "Oi, editado", at)
	c.revoke(c.sector.ID, "RV-1", "IN-1", false, at.Add(time.Second))

	tickets := c.tickets(c.sector.ID)
	if len(tickets) != 1 || tickets[0].Status != "closed" {
		t.Fatalf("tickets = %+v", tickets)
	}
	m := c.apiMessage(c.ticket.ID, c.token, "IN-1")
	if bodyOf(t, m) != "Oi, editado" || deletionOf(t, m)["scope"] != "everyone" {
		t.Fatalf("message = %v", m)
	}
}

// A mensagem é localizada pelo setor: o mesmo identificador em outro setor
// não é alterado. O cliente não altera mensagem do setor, o celular do setor
// não altera mensagem do cliente, e outro contato não altera nenhuma.
func TestChangesAreIsolatedBySectorAndAuthor(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	other := c.Sector("Fiscal")
	at := time.Now().Truncate(time.Microsecond).Add(time.Minute)

	c.edit(other.ID, "EV-A", "IN-1", "de outro setor", at)
	c.edit(c.sector.ID, "EV-B", "OUT-1", "o cliente edita o setor", at)
	c.editFromPhone(c.sector.ID, "EV-C", "IN-1", "o celular edita o cliente", at)
	c.revoke(c.sector.ID, "RV-D", "OUT-1", false, at)
	c.editAs(c.sector.ID, messaging.MessageEdited{
		ExternalEventID: "EV-E", TargetExternalMessageID: "IN-1",
		ExternalContactID: "5511900001111@s.whatsapp.net", Phone: "5511900001111", Body: "outro contato", At: at,
	})

	if m := c.apiMessage(c.ticket.ID, c.token, "IN-1"); bodyOf(t, m) != "Oi" || m["editedAt"] != nil || m["deletion"] != nil {
		t.Fatalf("IN-1 = %v", m)
	}
	if m := c.apiMessage(c.ticket.ID, c.token, "OUT-1"); bodyOf(t, m) != "Bom dia" || m["deletion"] != nil {
		t.Fatalf("OUT-1 = %v", m)
	}
	// O evento do outro setor espera uma mensagem dele, sem tocar esta.
	var linked int
	if err := c.Pool.QueryRow(t.Context(), "select count(*) from message_changes where message_id is not null").Scan(&linked); err != nil || linked != 0 {
		t.Fatalf("linked changes = %d (%v)", linked, err)
	}
	if n := len(c.tickets(other.ID)); n != 0 {
		t.Fatalf("tickets of the other sector = %d", n)
	}
}

// O aviso ao painel sai depois do commit: ao recebê-lo, a API já mostra a alteração.
func TestChangeNotifiesThePanelAfterTheCommit(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	events := c.subscribe(c.token)
	at := time.Now().Truncate(time.Microsecond).Add(time.Minute)

	c.edit(c.sector.ID, "EV-1", "IN-1", "Oi!", at)
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	if m := c.apiMessage(c.ticket.ID, c.token, "IN-1"); bodyOf(t, m) != "Oi!" {
		t.Fatalf("body after the event = %v", m["body"])
	}
	c.revoke(c.sector.ID, "RV-1", "IN-1", false, at.Add(time.Second))
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	if m := c.apiMessage(c.ticket.ID, c.token, "IN-1"); m["deletion"] == nil {
		t.Fatalf("deletion after the event = %v", m)
	}
	// Alteração ainda sem mensagem não avisa ninguém.
	c.edit(c.sector.ID, "EV-2", "IN-404", "?", at)
	c.noMoreEvents(events)
}

// Uma alteração e a mensagem original chegando ao mesmo tempo terminam sempre
// ligadas, em qualquer ordem.
func TestChangeAndOriginalArrivingTogetherAreAlwaysLinked(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	sent := time.Now().Truncate(time.Microsecond)
	const rounds = 15
	for i := range rounds {
		id := fmt.Sprintf("RACE-%d", i)
		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			msg := text(id, changeContact, changePhone, "antes")
			msg.SentAt = sent
			if err := c.WhatsApp.Receive(t.Context(), c.sector.ID, msg); err != nil {
				t.Error(err)
			}
		}()
		go func() {
			defer wg.Done()
			if err := c.WhatsApp.Edit(t.Context(), c.sector.ID, messaging.MessageEdited{
				ExternalEventID: "EV-" + id, TargetExternalMessageID: id,
				ExternalContactID: changeContact, Phone: changePhone, Body: "depois", At: sent.Add(time.Minute),
			}); err != nil {
				t.Error(err)
			}
		}()
		wg.Wait()
	}
	var unlinked, edited int
	err := c.Pool.QueryRow(t.Context(), `
		select (select count(*) from message_changes where message_id is null),
		       (select count(*) from messages where external_message_id like 'RACE-%' and body = 'depois' and edited_at is not null)`).
		Scan(&unlinked, &edited)
	if err != nil || unlinked != 0 || edited != rounds {
		t.Fatalf("unlinked = %d, edited = %d (%v), want 0 and %d", unlinked, edited, err, rounds)
	}
}

// Um provedor que não entrega alterações (indisponível) não muda nada.
func TestProviderWithoutChangeEventsChangesNothing(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	c.WhatsApp.SetCapabilities(messaging.Capabilities{})
	c.edit(c.sector.ID, "EV-1", "IN-1", "nunca chega", time.Now())
	if m := c.apiMessage(c.ticket.ID, c.token, "IN-1"); bodyOf(t, m) != "Oi" || c.Count("message_changes") != 0 {
		t.Fatalf("message = %v", m)
	}
	if got := c.WhatsApp.Capabilities(); got != (messaging.Capabilities{}) {
		t.Fatalf("capabilities = %+v", got)
	}
}

func versionsEqual(got, want []version) bool {
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i].Kind != want[i].Kind || got[i].Origin != want[i].Origin || got[i].Body != want[i].Body || !got[i].At.Equal(want[i].At) {
			return false
		}
	}
	return true
}

// Voltar ao texto anterior é uma versão nova, não um eco: em qualquer ordem de
// chegada, a mais nova fica como atual e todas ficam no histórico.
func TestEditBackToAnEarlierTextIsAVersionInAnyOrder(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	sent := c.messages(c.ticket.ID)[0].SentAt
	t1, t2 := sent.Add(time.Minute), sent.Add(2*time.Minute)

	// Oi → Olá em t1, Olá → Oi em t2; chega primeiro a de t2.
	c.edit(c.sector.ID, "EV-T2", "IN-1", "Oi", t2)
	c.edit(c.sector.ID, "EV-T1", "IN-1", "Olá", t1)

	m := c.apiMessage(c.ticket.ID, c.token, "IN-1")
	if bodyOf(t, m) != "Oi" || m["editedAt"] == nil {
		t.Fatalf("message = %v, want the version of t2", m)
	}
	want := []version{
		{Kind: "original", Origin: "customer", Body: "Oi", At: sent},
		{Kind: "edit", Origin: "customer", Body: "Olá", At: t1},
		{Kind: "edit", Origin: "customer", Body: "Oi", At: t2},
	}
	if got := c.changesOf(c.messageID(c.ticket.ID, "IN-1")); !versionsEqual(got, want) {
		t.Fatalf("changes = %+v\nwant %+v", got, want)
	}
}

// O mesmo quando a edição que volta ao texto original chega antes da
// mensagem, e a anterior, depois dela.
func TestPendingEditBackToTheOriginalTextIsApplied(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	sent := time.Now().Truncate(time.Microsecond)
	t1, t2 := sent.Add(time.Minute), sent.Add(2*time.Minute)

	// A → B em t1, B → A em t2; chegam t2, a original e t1.
	c.edit(c.sector.ID, "EV-T2", "IN-9", "A", t2)
	msg := text("IN-9", changeContact, changePhone, "A")
	msg.SentAt = sent
	c.receive(c.sector.ID, msg)
	c.edit(c.sector.ID, "EV-T1", "IN-9", "B", t1)

	if m := c.apiMessage(c.ticket.ID, c.token, "IN-9"); bodyOf(t, m) != "A" {
		t.Fatalf("body = %v, want the version of t2", m["body"])
	}
	want := []version{
		{Kind: "original", Origin: "customer", Body: "A", At: sent},
		{Kind: "edit", Origin: "customer", Body: "B", At: t1},
		{Kind: "edit", Origin: "customer", Body: "A", At: t2},
	}
	if got := c.changesOf(c.messageID(c.ticket.ID, "IN-9")); !versionsEqual(got, want) {
		t.Fatalf("changes = %+v\nwant %+v", got, want)
	}
}

// failLinkingChanges makes the database refuse to link a pending change to
// its message, until the returned function is called.
func (c reactionCase) failLinkingChanges() (restore func()) {
	c.T.Helper()
	ctx := c.T.Context()
	if _, err := c.Pool.Exec(ctx, `
		create function fail_link() returns trigger language plpgsql as
		$$ begin raise exception 'link refused'; end $$;
		create trigger fail_link before update of message_id on message_changes
		for each row execute function fail_link();`); err != nil {
		c.T.Fatal(err)
	}
	return func() {
		if _, err := c.Pool.Exec(ctx, "drop trigger fail_link on message_changes; drop function fail_link();"); err != nil {
			c.T.Fatal(err)
		}
	}
}

func (c reactionCase) unlinkedChanges() int {
	c.T.Helper()
	var n int
	if err := c.Pool.QueryRow(c.T.Context(), "select count(*) from message_changes where message_id is null").Scan(&n); err != nil {
		c.T.Fatal(err)
	}
	return n
}

// O envio pelo XET e o vínculo das alterações que chegaram antes dele são
// gravados juntos: uma falha no vínculo não deixa o envio confirmado com a
// alteração solta, e o reenvio depois do reinício liga a alteração.
func TestFailureLinkingPendingChangesDoesNotRecordTheSendAlone(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	c.connectSector(c.sector.ID)
	if r := c.assign(c.ticket.ID, c.token); r.Status != http.StatusOK {
		t.Fatalf("assign = %d %s", r.Status, r.Body)
	}
	const request = "6a2b3c4d-5e6f-4789-8abc-0d1e2f3a4b5c"
	target := "fake-msg-" + request
	at := time.Now().Add(time.Minute).Truncate(time.Microsecond)
	c.editFromPhone(c.sector.ID, "EV-F", target, "Ana Souza: corrigido", at)

	restore := c.failLinkingChanges()
	c.sendText(c.ticket.ID, c.token, request, "texto")
	all := c.outbound(c.ticket.ID)
	out := all[len(all)-1]
	if out.Origin != "agent" || str(out.Status) == "sent" || out.ExternalMessageID != nil {
		t.Fatalf("send recorded without its pending change: status %s, id %s", str(out.Status), str(out.ExternalMessageID))
	}
	restore()

	// A reentrega da alteração não a perde: continua esperando a mensagem.
	c.editFromPhone(c.sector.ID, "EV-F", target, "Ana Souza: corrigido", at)
	if n := c.unlinkedChanges(); n != 1 {
		t.Fatalf("unlinked = %d, want 1", n)
	}

	// Reinício e reenvio com a mesma chave: envio e vínculo gravados juntos.
	restarted := startServer(t, c.Pool, nil)
	if _, err := restarted.TicketService.FailPending(t.Context()); err != nil {
		t.Fatal(err)
	}
	restarted.connectSector(c.sector.ID)
	token := restarted.Login("ana@exemplo.com", testPassword)
	if r := restarted.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", out.ID), token, nil); r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("retry = %d %v", r.Status, r.Body)
	}
	if m := restarted.apiMessage(c.ticket.ID, token, target); bodyOf(t, m) != "Ana Souza: corrigido" {
		t.Fatalf("message = %v", m)
	}
	if n := c.unlinkedChanges(); n != 0 {
		t.Fatalf("unlinked = %d, want 0", n)
	}
}

// Uma alteração que ficou sem vínculo com a mensagem já gravada (por uma
// falha de antes) é ligada pela reentrega do mesmo evento, sem depender de
// outro evento.
func TestRedeliveryLinksAChangeLeftUnlinked(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	at := time.Now().Add(time.Minute).Truncate(time.Microsecond)
	if _, err := c.Pool.Exec(t.Context(), `
		insert into message_changes (sector_id, target_external_message_id, kind, origin, external_contact_id, phone, body, external_event_id, occurred_at)
		values ($1, 'OUT-1', 'edit', 'phone', $2, $3, 'Bom dia!', 'EV-L', $4)`,
		c.sector.ID, changeContact, changePhone, at); err != nil {
		t.Fatal(err)
	}
	events := c.subscribe(c.token)

	c.editFromPhone(c.sector.ID, "EV-L", "OUT-1", "Bom dia!", at)

	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	if m := c.apiMessage(c.ticket.ID, c.token, "OUT-1"); bodyOf(t, m) != "Bom dia!" {
		t.Fatalf("body = %v", m["body"])
	}
	if n := c.unlinkedChanges(); n != 0 {
		t.Fatalf("unlinked = %d, want 0", n)
	}
	if got := c.changesOf(c.messageID(c.ticket.ID, "OUT-1")); len(got) != 2 {
		t.Fatalf("changes = %+v", got)
	}
}
