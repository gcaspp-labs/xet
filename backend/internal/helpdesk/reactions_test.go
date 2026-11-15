package helpdesk_test

import (
	"context"
	"fmt"
	"net/http"
	"reflect"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const reactionContact = "5511988887777@s.whatsapp.net"

// react delivers a reaction of the contact to the message with the provider ID.
func (e *testEnv) react(sectorID int64, target, emoji string, at time.Time) {
	e.T.Helper()
	e.reactAs(sectorID, target, emoji, at, false)
}

// reactFromPhone delivers a reaction made from the phone of the sector.
func (e *testEnv) reactFromPhone(sectorID int64, target, emoji string, at time.Time) {
	e.T.Helper()
	e.reactAs(sectorID, target, emoji, at, true)
}

func (e *testEnv) reactAs(sectorID int64, target, emoji string, at time.Time, fromSectorPhone bool) {
	e.T.Helper()
	e.reaction(sectorID, messaging.ReactionReceived{
		TargetExternalMessageID: target, ExternalContactID: reactionContact, Phone: "5511988887777", Emoji: emoji,
		FromSectorPhone: fromSectorPhone, At: at,
	})
}

func (e *testEnv) reaction(sectorID int64, ev messaging.ReactionReceived) {
	e.T.Helper()
	if err := e.WhatsApp.React(e.T.Context(), sectorID, ev); err != nil {
		e.T.Fatalf("react to %s: %v", ev.TargetExternalMessageID, err)
	}
}

// reactionsOf returns the reactions of the message with the provider ID, as
// the messages API of the ticket shows them.
func (e *testEnv) reactionsOf(ticketID int64, token, externalID string) map[string]any {
	e.T.Helper()
	var id int64
	err := e.Pool.QueryRow(e.T.Context(), "select id from messages where ticket_id = $1 and external_message_id = $2", ticketID, externalID).Scan(&id)
	if err != nil {
		e.T.Fatalf("message %s: %v", externalID, err)
	}
	for _, m := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token) {
		if m["id"] == float64(id) {
			r, ok := m["reactions"].(map[string]any)
			if !ok {
				e.T.Fatalf("message without reactions: %v", m)
			}
			return r
		}
	}
	e.T.Fatalf("message %s not in the API", externalID)
	return nil
}

// reactionRows counts the stored reactions.
func (e *testEnv) reactionRows() int { return e.Count("message_reactions") }

type reactionCase struct {
	*testEnv
	sector db.Sector
	ana    db.User
	token  string
	ticket ticketRow
}

func newReactionCase(t *testing.T) reactionCase {
	t.Helper()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.Login("ana@exemplo.com", testPassword)
	e.receive(contab.ID, text("IN-1", reactionContact, "5511988887777", "Oi"))
	e.sendOutside(contab.ID, text("OUT-1", reactionContact, "5511988887777", "Bom dia"))
	return reactionCase{testEnv: e, sector: contab, ana: ana, token: token, ticket: e.tickets(contab.ID)[0]}
}

func (c reactionCase) reactions(externalID string) map[string]any {
	c.T.Helper()
	return c.reactionsOf(c.ticket.ID, c.token, externalID)
}

func (c reactionCase) closeFixtureTicket() {
	c.T.Helper()
	org, err := c.Q.CreateOrganization(c.T.Context(), db.CreateOrganizationParams{Name: "Prefeitura", MunicipalityID: c.Municipality("Itu")})
	if err != nil {
		c.T.Fatal(err)
	}
	c.closeTicket(c.ticket.ID, c.ana.ID, org.ID)
}

// noMoreEvents fails when the panel is notified in the next moments. Waiting
// closes the connection, so it is the last use of it.
func (c reactionCase) noMoreEvents(conn *websocket.Conn) {
	c.T.Helper()
	ctx, cancel := context.WithTimeout(c.T.Context(), 300*time.Millisecond)
	defer cancel()
	var ev realtime.Event
	if err := wsjson.Read(ctx, conn, &ev); err == nil {
		c.T.Fatalf("unexpected event: %+v", ev)
	}
}

func emojiOf(t *testing.T, side any) string {
	t.Helper()
	m, ok := side.(map[string]any)
	if !ok {
		return ""
	}
	return m["emoji"].(string)
}

func TestCustomerReactionIsRecordedReplacedAndRemoved(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)

	// Sem reação, os dois lados vêm vazios.
	if r := c.reactions("IN-1"); r["customer"] != nil || r["sector"] != nil {
		t.Fatalf("reactions before = %v", r)
	}

	// Vale para a mensagem recebida e para a enviada pelo setor.
	c.react(c.sector.ID, "IN-1", "👍", now)
	c.react(c.sector.ID, "OUT-1", "❤️", now)
	for id, want := range map[string]string{"IN-1": "👍", "OUT-1": "❤️"} {
		r := c.reactions(id)
		if got := emojiOf(t, r["customer"]); got != want || r["sector"] != nil {
			t.Fatalf("reactions of %s = %v, want customer %s", id, r, want)
		}
		if _, ok := r["customer"].(map[string]any)["at"].(string); !ok {
			t.Fatalf("customer reaction without time: %v", r["customer"])
		}
	}

	// Outra reação do cliente substitui a anterior: continua uma só.
	c.react(c.sector.ID, "IN-1", "😂", now.Add(time.Second))
	if got := emojiOf(t, c.reactions("IN-1")["customer"]); got != "😂" {
		t.Fatalf("replaced reaction = %q, want 😂", got)
	}
	if n := c.reactionRows(); n != 2 {
		t.Fatalf("reaction rows = %d, want 2", n)
	}

	// Reação vazia apaga; as demais ficam.
	c.react(c.sector.ID, "IN-1", "", now.Add(2*time.Second))
	if r := c.reactions("IN-1"); r["customer"] != nil {
		t.Fatalf("removed reaction = %v", r["customer"])
	}
	if got := emojiOf(t, c.reactions("OUT-1")["customer"]); got != "❤️" {
		t.Fatalf("other reaction = %q, want ❤️", got)
	}
	// Remover o que não existe não é erro.
	c.react(c.sector.ID, "IN-1", "", now.Add(3*time.Second))
}

func TestReactionToClosedTicketOrUnknownMessageIsDiscarded(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)
	c.react(c.sector.ID, "IN-1", "👍", now)
	c.reactFromPhone(c.sector.ID, "OUT-1", "🙏", now)
	c.closeFixtureTicket()

	tickets, messages, contacts, rows := c.Count("tickets"), c.Count("messages"), c.Count("contacts"), c.reactionRows()
	before := c.reactions("IN-1")

	// Chamado encerrado: nem troca, nem remoção, nem reação nova, do cliente ou do celular.
	c.react(c.sector.ID, "IN-1", "😢", now.Add(time.Second))
	c.react(c.sector.ID, "OUT-1", "😮", now.Add(time.Second))
	c.react(c.sector.ID, "IN-1", "", now.Add(2*time.Second))
	c.reactFromPhone(c.sector.ID, "OUT-1", "❤️", now.Add(2*time.Second))
	c.reactFromPhone(c.sector.ID, "IN-1", "", now.Add(3*time.Second))
	// Mensagem que o XET não tem, de um contato conhecido e de um desconhecido.
	c.react(c.sector.ID, "NAO-EXISTE", "👍", now)
	c.reactFromPhone(c.sector.ID, "NAO-EXISTE", "👍", now)
	c.reaction(c.sector.ID, messaging.ReactionReceived{
		TargetExternalMessageID: "OUTRA", ExternalContactID: "5511977776666@s.whatsapp.net", Phone: "5511977776666", Emoji: "👍", At: now,
	})
	// A mensagem existe em outro setor, não neste.
	rh := c.Sector("RH")
	c.react(rh.ID, "IN-1", "👍", now.Add(time.Second))

	if got := [4]int{c.Count("tickets"), c.Count("messages"), c.Count("contacts"), c.reactionRows()}; got != [4]int{tickets, messages, contacts, rows} {
		t.Fatalf("tickets, messages, contacts, reactions = %v, want %v", got, [4]int{tickets, messages, contacts, rows})
	}
	if after := c.reactions("IN-1"); !reflect.DeepEqual(before, after) {
		t.Fatalf("reactions of the closed ticket changed: %v -> %v", before, after)
	}
	if st := c.tickets(c.sector.ID); len(st) != 1 || st[0].Status != "closed" {
		t.Fatalf("tickets = %+v", st)
	}
}

func TestReactionFromTheSectorPhoneReplacesTheSectorSide(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)

	// O atendente reagiu pelo sistema (a tarefa de reagir ainda não existe): grava direto.
	_, err := c.Pool.Exec(c.T.Context(), `
		insert into message_reactions (message_id, side, emoji, author_id, reacted_at)
		select id, 'sector', '👍', $2, $3 from messages where ticket_id = $1 and external_message_id = 'IN-1'`,
		c.ticket.ID, c.ana.ID, now)
	if err != nil {
		t.Fatal(err)
	}
	sector, _ := c.reactions("IN-1")["sector"].(map[string]any)
	by, _ := sector["by"].(map[string]any)
	if sector["emoji"] != "👍" || sector["viaPhone"] != false || by["id"] != float64(c.ana.ID) || by["name"] != c.ana.Name {
		t.Fatalf("agent reaction = %v", sector)
	}

	// A do celular substitui a do atendente e vem marcada como "pelo celular", sem quem reagiu.
	c.reactFromPhone(c.sector.ID, "IN-1", "🙏", now.Add(time.Second))
	r := c.reactions("IN-1")
	sector, _ = r["sector"].(map[string]any)
	if sector["emoji"] != "🙏" || sector["viaPhone"] != true || sector["by"] != nil || r["customer"] != nil {
		t.Fatalf("phone reaction = %v", r)
	}

	// Os dois lados não se misturam: as duas reações convivem na mesma mensagem.
	c.react(c.sector.ID, "IN-1", "😂", now.Add(2*time.Second))
	r = c.reactions("IN-1")
	if emojiOf(t, r["customer"]) != "😂" || emojiOf(t, r["sector"]) != "🙏" {
		t.Fatalf("both sides = %v", r)
	}
	if n := c.reactionRows(); n != 2 {
		t.Fatalf("reaction rows = %d, want 2", n)
	}

	// Remover pelo celular apaga só o lado do setor.
	c.reactFromPhone(c.sector.ID, "IN-1", "", now.Add(3*time.Second))
	r = c.reactions("IN-1")
	if r["sector"] != nil || emojiOf(t, r["customer"]) != "😂" {
		t.Fatalf("after phone removal = %v", r)
	}

	// A reação do setor também vale para a mensagem enviada pelo setor.
	c.reactFromPhone(c.sector.ID, "OUT-1", "👍", now.Add(4*time.Second))
	if got := emojiOf(t, c.reactions("OUT-1")["sector"]); got != "👍" {
		t.Fatalf("reaction to a message of the sector = %q", got)
	}
}

func TestReactionIsNotAMessage(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)

	// Uma antiga, já gravada como unsupported, fica como está.
	old := text("OLD-REACTION", reactionContact, "5511988887777", "")
	old.Type = messaging.TypeUnsupported
	c.receive(c.sector.ID, old)
	messages := c.Count("messages")

	c.react(c.sector.ID, "IN-1", "👍", now)
	c.react(c.sector.ID, "IN-1", "", now.Add(time.Second))
	c.reactFromPhone(c.sector.ID, "OUT-1", "🙏", now)
	// Reação de grupo: ignorada, como a mensagem de grupo, mesmo que o alvo exista.
	c.reaction(c.sector.ID, messaging.ReactionReceived{TargetExternalMessageID: "IN-1", Group: true, Emoji: "😮", At: now.Add(2 * time.Second)})

	if got := c.Count("messages"); got != messages {
		t.Fatalf("messages = %d, want %d: a reaction must not be recorded as a message", got, messages)
	}
	var unsupported int
	err := c.Pool.QueryRow(c.T.Context(), "select count(*) from messages where type = 'unsupported'").Scan(&unsupported)
	if err != nil || unsupported != 1 {
		t.Fatalf("unsupported messages = %d (%v), want only the old one", unsupported, err)
	}
	if r := c.reactions("IN-1"); r["customer"] != nil {
		t.Fatalf("group reaction was recorded: %v", r)
	}

	// Em grupo, mesmo sem alvo no XET, nada é gravado.
	rows := c.reactionRows()
	c.reaction(c.sector.ID, messaging.ReactionReceived{TargetExternalMessageID: "GRP-1", Group: true, Emoji: "👍", At: now})
	if c.reactionRows() != rows || c.Count("tickets") != 1 {
		t.Fatalf("group reaction left rows: reactions %d, tickets %d", c.reactionRows(), c.Count("tickets"))
	}
}

func TestLateAndRepeatedReactionEventsChangeNothing(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)

	c.react(c.sector.ID, "IN-1", "❤️", now)
	events := c.subscribe(c.token)

	// O mesmo evento entregue de novo não muda nada (nem avisa o painel).
	c.react(c.sector.ID, "IN-1", "❤️", now)
	// Um evento mais antigo, de troca ou de remoção, não desfaz a mais nova.
	c.react(c.sector.ID, "IN-1", "😂", now.Add(-time.Second))
	c.react(c.sector.ID, "IN-1", "", now.Add(-time.Second))
	if got := emojiOf(t, c.reactions("IN-1")["customer"]); got != "❤️" {
		t.Fatalf("reaction after late events = %q, want ❤️", got)
	}
	// Idem para o celular do setor.
	c.reactFromPhone(c.sector.ID, "IN-1", "🙏", now)
	c.reactFromPhone(c.sector.ID, "IN-1", "👍", now.Add(-time.Minute))
	c.reactFromPhone(c.sector.ID, "IN-1", "", now.Add(-time.Minute))
	if got := emojiOf(t, c.reactions("IN-1")["sector"]); got != "🙏" {
		t.Fatalf("sector reaction after late events = %q, want 🙏", got)
	}
	if n := c.reactionRows(); n != 2 {
		t.Fatalf("reaction rows = %d, want 2", n)
	}

	// Só as mudanças avisaram o painel: a do celular é o primeiro aviso, e o da troca vem logo depois.
	want := realtime.TicketChanged(c.sector.ID, c.ticket.ID)
	if ev := c.nextEvent(events); ev != want {
		t.Fatalf("first event = %+v", ev)
	}
	c.react(c.sector.ID, "IN-1", "😮", now.Add(time.Second))
	if ev := c.nextEvent(events); ev != want {
		t.Fatalf("second event = %+v", ev)
	}
}

func TestReactionNotifiesThePanelAndKeepsTheLists(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	now := time.Now().Truncate(time.Microsecond)
	other := c.queuedTicket(c.sector.ID, "IN-2", "5511977776666")
	list := fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID)
	before := c.DoList(http.MethodGet, list, c.token)
	if len(before) != 2 || before[0]["id"] != float64(c.ticket.ID) || before[1]["id"] != float64(other.ID) {
		t.Fatalf("tickets = %v", before)
	}

	events := c.subscribe(c.token)
	c.react(c.sector.ID, "IN-1", "👍", now.Add(time.Hour))
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	c.reactFromPhone(c.sector.ID, "OUT-1", "🙏", now.Add(time.Hour))
	if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event of the phone reaction = %+v", ev)
	}

	// A última mensagem e a ordem das listas continuam as mesmas.
	if after := c.DoList(http.MethodGet, list, c.token); !reflect.DeepEqual(before, after) {
		t.Fatalf("lists changed with the reaction:\nbefore %v\nafter  %v", before, after)
	}
}

// A removal is a change of the side like any other: an older event delivered
// again, even the very reaction that was removed, must not bring it back.
func TestRemovedReactionDoesNotComeBackWhenAnOldEventIsDeliveredAgain(t *testing.T) {
	t.Parallel()
	sides := []struct {
		name  string
		react func(c reactionCase, emoji string, at time.Time)
		side  string
		other string
	}{
		{"customer", func(c reactionCase, emoji string, at time.Time) { c.react(c.sector.ID, "IN-1", emoji, at) }, "customer", "sector"},
		{"sector phone", func(c reactionCase, emoji string, at time.Time) { c.reactFromPhone(c.sector.ID, "IN-1", emoji, at) }, "sector", "customer"},
	}
	for _, tc := range sides {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			c := newReactionCase(t)
			t1 := time.Now().Truncate(time.Microsecond)
			t2 := t1.Add(time.Second)
			events := c.subscribe(c.token)

			tc.react(c, "👍", t1) // reaction at T1
			if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
				t.Fatalf("event of the reaction = %+v", ev)
			}
			tc.react(c, "", t2) // removal at T2
			if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
				t.Fatalf("event of the removal = %+v", ev)
			}
			if r := c.reactions("IN-1"); r[tc.side] != nil || r[tc.other] != nil {
				t.Fatalf("reactions after removal = %v", r)
			}

			// The provider delivers T1 again, and the removal again. A connection of its
			// own listens to them, since waiting for silence closes it.
			replays := c.subscribe(c.token)
			tc.react(c, "👍", t1)
			tc.react(c, "", t2)
			tc.react(c, "😂", t1.Add(500*time.Millisecond)) // another old event, between the two
			if r := c.reactions("IN-1"); r[tc.side] != nil || r[tc.other] != nil {
				t.Fatalf("removed reaction came back: %v", r)
			}
			c.noMoreEvents(replays)

			// A newer reaction still works, and the removed one is not a barrier.
			tc.react(c, "🙏", t2.Add(time.Second))
			if got := emojiOf(t, c.reactions("IN-1")[tc.side]); got != "🙏" {
				t.Fatalf("newer reaction = %q, want 🙏", got)
			}
			if ev := c.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
				t.Fatalf("event of the newer reaction = %+v", ev)
			}
		})
	}
}

// A removal that arrives before the first reaction, which was older, is the
// newest word: the old reaction delivered afterwards is discarded.
func TestRemovalReceivedBeforeAnOlderReactionWins(t *testing.T) {
	t.Parallel()
	for _, side := range []struct {
		name  string
		react func(c reactionCase, emoji string, at time.Time)
		side  string
	}{
		{"customer", func(c reactionCase, emoji string, at time.Time) { c.react(c.sector.ID, "IN-1", emoji, at) }, "customer"},
		{"sector phone", func(c reactionCase, emoji string, at time.Time) { c.reactFromPhone(c.sector.ID, "IN-1", emoji, at) }, "sector"},
	} {
		t.Run(side.name, func(t *testing.T) {
			t.Parallel()
			c := newReactionCase(t)
			t1 := time.Now().Truncate(time.Microsecond)
			events := c.subscribe(c.token)

			// Removal at T2 with nothing to remove: recorded for the order, nobody notified.
			side.react(c, "", t1.Add(time.Second))
			if r := c.reactions("IN-1"); r[side.side] != nil {
				t.Fatalf("reaction after a removal with nothing to remove = %v", r)
			}
			// The reaction at T1 arrives late.
			side.react(c, "👍", t1)
			if r := c.reactions("IN-1"); r["customer"] != nil || r["sector"] != nil {
				t.Fatalf("late reaction was recorded: %v", r)
			}

			// Same time as the removal: the removal wins.
			side.react(c, "👍", t1.Add(time.Second))
			if r := c.reactions("IN-1"); r[side.side] != nil {
				t.Fatalf("reaction at the time of the removal = %v", r)
			}
			c.noMoreEvents(events)
		})
	}
}

// The removal in the same instant as the reaction (the provider has a
// resolution of seconds) must still remove it, and then block its replay.
func TestRemovalAtTheSameTimeAsTheReactionRemovesIt(t *testing.T) {
	t.Parallel()
	c := newReactionCase(t)
	at := time.Now().Truncate(time.Second)

	c.react(c.sector.ID, "IN-1", "👍", at)
	c.react(c.sector.ID, "IN-1", "", at)
	if r := c.reactions("IN-1"); r["customer"] != nil {
		t.Fatalf("reaction after a removal at the same time = %v", r["customer"])
	}
	c.react(c.sector.ID, "IN-1", "👍", at)
	if r := c.reactions("IN-1"); r["customer"] != nil {
		t.Fatalf("replay of the reaction at the same time = %v", r["customer"])
	}
}
