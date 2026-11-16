package helpdesk_test

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	quoteContact = "5511988887777@s.whatsapp.net"
	quotePhone   = "5511988887777"
)

type quoteCase struct {
	*testEnv
	sector db.Sector
	ana    db.User
	token  string
}

func newQuoteCase(t *testing.T) quoteCase {
	t.Helper()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	return quoteCase{testEnv: e, sector: contab, ana: ana, token: e.Login("ana@exemplo.com", testPassword)}
}

// quoting returns a text of the contact that cites the message with the
// provider ID, with the snippet when one is given.
func quoting(id, body, quoted string, snippet *messaging.QuoteSnippet) messaging.Message {
	m := text(id, quoteContact, quotePhone, body)
	m.Quote = &messaging.Quote{ExternalMessageID: quoted, Snippet: snippet}
	return m
}

func textSnippet(s string) *messaging.QuoteSnippet {
	return &messaging.QuoteSnippet{Type: messaging.TypeText, Text: s}
}

// apiMessage returns the message with the provider ID as the messages API of
// the ticket shows it.
func (c quoteCase) apiMessage(ticketID int64, externalID string) map[string]any {
	c.T.Helper()
	id := c.messageID(ticketID, externalID)
	for _, m := range c.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), c.token) {
		if m["id"] == float64(id) {
			return m
		}
	}
	c.T.Fatalf("message %s not in the API", externalID)
	return nil
}

func (c quoteCase) messageID(ticketID int64, externalID string) int64 {
	c.T.Helper()
	var id int64
	err := c.Pool.QueryRow(c.T.Context(), "select id from messages where ticket_id = $1 and external_message_id = $2", ticketID, externalID).Scan(&id)
	if err != nil {
		c.T.Fatalf("message %s: %v", externalID, err)
	}
	return id
}

// quoteOf returns the quote of the message in the API; nil when it is null.
func (c quoteCase) quoteOf(ticketID int64, externalID string) map[string]any {
	c.T.Helper()
	m := c.apiMessage(ticketID, externalID)
	q, present := m["quote"]
	if !present {
		c.T.Fatalf("message without the quote field: %v", m)
	}
	if q == nil {
		return nil
	}
	return q.(map[string]any)
}

func wantQuote(t *testing.T, got map[string]any, messageID any, typ, text any) {
	t.Helper()
	want := map[string]any{"messageId": messageID, "type": typ, "text": text}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("quote = %v, want %v", got, want)
	}
}

func TestQuoteOfMessageInTheSameTicketIsLinked(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("IN-1", quoteContact, quotePhone, "Qual o prazo?"))
	c.sendOutside(c.sector.ID, text("OUT-1", quoteContact, quotePhone, "Até sexta"))

	// O cliente cita a própria mensagem e a do setor; com trecho e só com o identificador.
	c.receive(c.sector.ID, quoting("IN-2", "Isso mesmo", "IN-1", textSnippet("Qual o prazo?")))
	c.receive(c.sector.ID, quoting("IN-3", "Combinado", "OUT-1", nil))
	// O celular do setor também responde citando.
	out := text("OUT-2", quoteContact, quotePhone, "Confirmado")
	out.Quote = &messaging.Quote{ExternalMessageID: "IN-2", Snippet: textSnippet("Isso mesmo")}
	c.sendOutside(c.sector.ID, out)

	ticket := c.tickets(c.sector.ID)[0].ID
	wantQuote(t, c.quoteOf(ticket, "IN-2"), float64(c.messageID(ticket, "IN-1")), "text", "Qual o prazo?")
	// Sem trecho, a ligação basta: a tela mostra a mensagem ligada.
	wantQuote(t, c.quoteOf(ticket, "IN-3"), float64(c.messageID(ticket, "OUT-1")), nil, nil)
	wantQuote(t, c.quoteOf(ticket, "OUT-2"), float64(c.messageID(ticket, "IN-2")), "text", "Isso mesmo")
	if m := c.apiMessage(ticket, "OUT-2"); m["origin"] != "phone" || m["body"] != "Confirmado" {
		t.Fatalf("message from the phone = %v", m)
	}
}

func TestQuoteOfMessageOutsideTheTicketIsNotLinked(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	// Conversa anterior, já encerrada, do mesmo contato.
	c.receive(c.sector.ID, text("OLD-1", quoteContact, quotePhone, "Segredo do chamado anterior"))
	org, err := c.Q.CreateOrganization(c.T.Context(), db.CreateOrganizationParams{Name: "Prefeitura", MunicipalityID: c.Municipality("Itu")})
	if err != nil {
		t.Fatal(err)
	}
	c.closeTicket(c.tickets(c.sector.ID)[0].ID, c.ana.ID, org.ID)
	// A mesma mensagem existe também noutro setor.
	rh := c.Sector("RH")
	c.receive(rh.ID, text("RH-1", quoteContact, quotePhone, "Conteúdo do RH"))

	// Mensagem de outro chamado, com o trecho do WhatsApp.
	c.receive(c.sector.ID, quoting("NEW-1", "Sobre aquilo", "OLD-1", textSnippet("Trecho do WhatsApp")))
	// Mensagem que o XET não tem (de antes do XET), com trecho.
	c.receive(c.sector.ID, quoting("NEW-2", "E isto?", "ANTES-DO-XET", textSnippet("Mensagem antiga")))
	// Mensagem de outro setor, só com o identificador.
	c.receive(c.sector.ID, quoting("NEW-3", "E aquilo?", "RH-1", nil))
	// Só com o identificador, de mensagem que o XET não tem.
	c.receive(c.sector.ID, quoting("NEW-4", "Oi?", "DESCONHECIDA", nil))

	tickets := c.tickets(c.sector.ID)
	if len(tickets) != 2 {
		t.Fatalf("tickets = %d, want 2", len(tickets))
	}
	ticket := tickets[1].ID
	wantQuote(t, c.quoteOf(ticket, "NEW-1"), nil, "text", "Trecho do WhatsApp")
	wantQuote(t, c.quoteOf(ticket, "NEW-2"), nil, "text", "Mensagem antiga")
	wantQuote(t, c.quoteOf(ticket, "NEW-3"), nil, nil, nil)
	wantQuote(t, c.quoteOf(ticket, "NEW-4"), nil, nil, nil)

	// O conteúdo dos outros chamados não aparece na conversa deste.
	for _, m := range c.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticket), c.token) {
		s := fmt.Sprint(m)
		if strings.Contains(s, "Segredo") || strings.Contains(s, "Conteúdo do RH") {
			t.Fatalf("content of another ticket exposed: %v", m)
		}
	}
	if n := len(c.messages(ticket)); n != 4 {
		t.Fatalf("messages = %d, want 4", n)
	}
}

func TestMessageWithoutQuoteIsUnchanged(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("IN-1", quoteContact, quotePhone, "Oi"))
	// Citação vazia (o provedor não identificou a citada) vale como sem citação.
	empty := text("IN-2", quoteContact, quotePhone, "Tudo bem?")
	empty.Quote = &messaging.Quote{}
	c.receive(c.sector.ID, empty)

	ticket := c.tickets(c.sector.ID)[0].ID
	for _, id := range []string{"IN-1", "IN-2"} {
		if q := c.quoteOf(ticket, id); q != nil {
			t.Fatalf("quote of %s = %v, want null", id, q)
		}
	}
	var quoted int
	if err := c.Pool.QueryRow(c.T.Context(), "select count(*) from messages where quoted_external_message_id is not null").Scan(&quoted); err != nil {
		t.Fatal(err)
	}
	if quoted != 0 {
		t.Fatalf("messages with quote = %d, want 0", quoted)
	}
}

func TestQuoteOfMediaShowsTypeAndNameWithoutTheFile(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("IN-1", quoteContact, quotePhone, "Oi"))
	files := c.Count("media_files")

	cases := []struct {
		id      string
		snippet messaging.QuoteSnippet
		typ     string
		text    any
	}{
		{"Q-AUDIO", messaging.QuoteSnippet{Type: messaging.TypeAudio}, "audio", nil},
		{"Q-IMAGE", messaging.QuoteSnippet{Type: messaging.TypeImage, Text: "Foto da nota"}, "image", "Foto da nota"},
		{"Q-VIDEO", messaging.QuoteSnippet{Type: messaging.TypeVideo}, "video", nil},
		{"Q-DOC", messaging.QuoteSnippet{Type: messaging.TypeDocument, Text: "contrato.pdf"}, "document", "contrato.pdf"},
		{"Q-STICKER", messaging.QuoteSnippet{Type: messaging.TypeUnsupported}, "unsupported", nil},
	}
	for _, tc := range cases {
		sn := tc.snippet
		c.receive(c.sector.ID, quoting(tc.id, "Sobre isto", "MIDIA-"+tc.id, &sn))
	}
	// A própria resposta pode ser uma mídia: a citação vale para qualquer tipo.
	reply := quoting("IMG-REPLY", "Veja", "IN-1", textSnippet("Oi"))
	reply.Type = messaging.TypeImage
	reply.Media = &messaging.Media{Data: []byte("bytes da imagem"), MimeType: "image/jpeg"}
	c.receive(c.sector.ID, reply)

	ticket := c.tickets(c.sector.ID)[0].ID
	for _, tc := range cases {
		wantQuote(t, c.quoteOf(ticket, tc.id), nil, tc.typ, tc.text)
	}
	m := c.apiMessage(ticket, "IMG-REPLY")
	if m["type"] != "image" || m["media"] == nil {
		t.Fatalf("image reply = %v", m)
	}
	wantQuote(t, m["quote"].(map[string]any), float64(c.messageID(ticket, "IN-1")), "text", "Oi")
	// Só o arquivo da resposta foi guardado; a mídia citada não é baixada nem guardada.
	if n := c.Count("media_files"); n != files+1 {
		t.Fatalf("media files = %d, want %d", n, files+1)
	}
}

func TestRepeatedQuotedMessageIsRecordedOnce(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("IN-1", quoteContact, quotePhone, "Oi"))
	msg := quoting("IN-2", "Isso", "IN-1", textSnippet("Oi"))
	c.receive(c.sector.ID, msg)
	// A reentrega, mesmo com outra citação, não muda nem duplica nada.
	again := quoting("IN-2", "Isso", "OUTRA", nil)
	c.receive(c.sector.ID, again)

	ticket := c.tickets(c.sector.ID)[0].ID
	if n := len(c.messages(ticket)); n != 2 {
		t.Fatalf("messages = %d, want 2", n)
	}
	wantQuote(t, c.quoteOf(ticket, "IN-2"), float64(c.messageID(ticket, "IN-1")), "text", "Oi")
}

// The database refuses a link to a message of another ticket, even if the code
// did not check it.
func TestDatabaseRefusesQuoteLinkToAnotherTicket(t *testing.T) {
	t.Parallel()
	c := newQuoteCase(t)
	c.receive(c.sector.ID, text("A-1", quoteContact, quotePhone, "Oi"))
	rh := c.Sector("RH")
	c.receive(rh.ID, text("B-1", quoteContact, quotePhone, "Oi"))
	a := c.tickets(c.sector.ID)[0].ID
	b := c.tickets(rh.ID)[0].ID

	_, err := c.Pool.Exec(c.T.Context(),
		"update messages set quoted_external_message_id = 'A-1', quoted_message_id = $1 where id = $2",
		c.messageID(a, "A-1"), c.messageID(b, "B-1"))
	if err == nil || !strings.Contains(err.Error(), "messages_quote_same_ticket") {
		t.Fatalf("cross-ticket link error = %v, want messages_quote_same_ticket", err)
	}
	// Ligação ou trecho sem o identificador da citada também é recusado.
	_, err = c.Pool.Exec(c.T.Context(), "update messages set quoted_type = 'text' where id = $1", c.messageID(a, "A-1"))
	if err == nil || !strings.Contains(err.Error(), "messages_quote_external_id") {
		t.Fatalf("snippet without id error = %v, want messages_quote_external_id", err)
	}
}
