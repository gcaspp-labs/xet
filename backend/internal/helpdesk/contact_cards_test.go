package helpdesk_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

var (
	joaoCard = messaging.ContactCard{
		Name:         "João Silva",
		Organization: "Prefeitura de Itu",
		Phones: []messaging.ContactPhone{
			{Phone: "5511977776666", WhatsAppID: "5511977776666"},
			{Phone: "1140221000"},
		},
	}
	mariaCard = messaging.ContactCard{Name: "Maria", Phones: []messaging.ContactPhone{{Phone: "5521966665555"}}}
)

// The contact the customer sends is recorded as a contact message with its
// cards, in order, by the rules of every received message: it opens the
// ticket, and a redelivery changes nothing. One sent from the phone of the
// sector is recorded too.
func TestReceivedContactIsRecordedWithItsCards(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")

	e.receive(contab.ID, contactMessage("CT-1", joaoCard, mariaCard))
	e.receive(contab.ID, contactMessage("CT-1", joaoCard, mariaCard))
	outside := contactMessage("CT-2", mariaCard)
	e.sendOutside(contab.ID, outside)

	tickets := e.tickets(contab.ID)
	if len(tickets) != 1 || tickets[0].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	msgs := e.messages(tickets[0].ID)
	if len(msgs) != 2 {
		t.Fatalf("messages = %d, want 2 (redelivery must not duplicate)", len(msgs))
	}
	if m := msgs[0]; m.Type != "contact" || m.Direction != "inbound" || m.Origin != "customer" || m.Body != nil || m.MediaID != nil {
		t.Fatalf("received contact = %+v", m)
	}
	if m := msgs[1]; m.Type != "contact" || m.Direction != "outbound" || m.Origin != "phone" || m.Status == nil || *m.Status != "sent" {
		t.Fatalf("contact from the phone = %+v", m)
	}

	_, cards := e.storedCards("CT-1")
	want := jsonValue(t, `[
		{"name": "João Silva", "organization": "Prefeitura de Itu", "phones": [
			{"phone": "5511977776666", "wa_id": "5511977776666"}, {"phone": "1140221000", "wa_id": null}]},
		{"name": "Maria", "organization": null, "phones": [{"phone": "5521966665555", "wa_id": null}]}]`)
	if !reflect.DeepEqual(cards, want) {
		t.Fatalf("cards = %v\nwant %v", cards, want)
	}
	if _, cards := e.storedCards("CT-2"); !reflect.DeepEqual(cards, jsonValue(t,
		`[{"name": "Maria", "organization": null, "phones": [{"phone": "5521966665555", "wa_id": null}]}]`)) {
		t.Fatalf("cards from the phone = %v", cards)
	}
}

// The fake adapter takes a contact with its cards through its HTTP API, as
// the end-to-end tests use it.
func TestFakeReceivesContactOverHTTP(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")

	body := `{"externalMessageId": "CT-HTTP", "phone": "5511988887777", "type": "contact", "contactCards": [
		{"name": "João Silva", "organization": "Prefeitura de Itu", "phones": [{"phone": "+55 11 97777-6666", "whatsAppId": "5511977776666"}]},
		{"name": "Maria", "phones": []}]}`
	req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, fmt.Sprintf("/messaging/sectors/%d/receive", contab.ID), strings.NewReader(body))
	rec := httptest.NewRecorder()
	e.WhatsApp.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("receive = %d %s", rec.Code, rec.Body)
	}
	typ, cards := e.storedCards("CT-HTTP")
	want := jsonValue(t, `[
		{"name": "João Silva", "organization": "Prefeitura de Itu", "phones": [{"phone": "5511977776666", "wa_id": "5511977776666"}]},
		{"name": "Maria", "organization": null, "phones": []}]`)
	if typ != "contact" || !reflect.DeepEqual(cards, want) {
		t.Fatalf("type = %s, cards = %v\nwant %v", typ, cards, want)
	}
}

// The messages API returns the cards of a contact message, and the ticket
// list shows the type and the name of the first card as the last message.
// Other messages have no cards.
func TestContactCardsInTheAPI(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("IN-1", cardContact, cardPhone, "Bom dia"))
	c.receive(c.sector.ID, contactMessage("CT-1", joaoCard, mariaCard))
	ticket := c.tickets(c.sector.ID)[0].ID

	if got := c.apiMessage(ticket, "IN-1")["contactCards"]; got != nil {
		t.Fatalf("text with cards: %v", got)
	}
	m := c.apiMessage(ticket, "CT-1")
	want := jsonValue(t, `[
		{"name": "João Silva", "organization": "Prefeitura de Itu", "phones": [
			{"phone": "5511977776666", "whatsAppId": "5511977776666"}, {"phone": "1140221000", "whatsAppId": null}]},
		{"name": "Maria", "organization": null, "phones": [{"phone": "5521966665555", "whatsAppId": null}]}]`)
	if m["type"] != "contact" || m["body"] != nil || !reflect.DeepEqual(m["contactCards"], want) {
		t.Fatalf("contact in the API = %v", m)
	}

	list := c.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.token)
	if len(list) != 1 {
		t.Fatalf("tickets = %v", list)
	}
	last := list[0]["lastMessage"].(map[string]any)
	if last["type"] != "contact" || last["contactName"] != "João Silva" || last["body"] != nil || last["hidden"] != false {
		t.Fatalf("last message = %v", last)
	}

	// A text after it is the last message again, without a card name.
	c.receive(c.sector.ID, text("IN-2", cardContact, cardPhone, "Esse é o contato"))
	list = c.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.token)
	if last := list[0]["lastMessage"].(map[string]any); last["type"] != "text" || last["contactName"] != nil {
		t.Fatalf("last message = %v", last)
	}
}

// A contact recorded as unsupported before cards were read stays
// unsupported, without cards. A contact message without any usable card
// (no name) is recorded as unsupported too, never failing the reception.
func TestUnsupportedMessagesStayUnsupported(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	old := text("OLD-1", cardContact, cardPhone, "")
	old.Type = messaging.TypeUnsupported
	c.receive(c.sector.ID, old)
	c.receive(c.sector.ID, contactMessage("CT-BAD", messaging.ContactCard{Name: "  ", Phones: []messaging.ContactPhone{{Phone: "5511977776666"}}}))
	ticket := c.tickets(c.sector.ID)[0].ID

	for _, id := range []string{"OLD-1", "CT-BAD"} {
		if typ, cards := c.storedCards(id); typ != string(db.MessageTypeUnsupported) || cards != nil {
			t.Fatalf("%s: type = %s, cards = %v", id, typ, cards)
		}
		if m := c.apiMessage(ticket, id); m["type"] != "unsupported" || m["contactCards"] != nil {
			t.Fatalf("%s in the API = %v", id, m)
		}
	}
	list := c.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.token)
	if last := list[0]["lastMessage"].(map[string]any); last["type"] != "unsupported" || last["contactName"] != nil {
		t.Fatalf("last message = %v", last)
	}
}
