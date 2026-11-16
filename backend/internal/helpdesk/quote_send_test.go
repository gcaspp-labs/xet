package helpdesk_test

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	requestQ1 = "c1d2e3f4-0a1b-4c2d-8e3f-405162738495"
	requestQ2 = "d2e3f405-1b2c-4d3e-9f40-5162738495a6"
	requestQ3 = "e3f40516-2c3d-4e4f-a051-62738495a6b7"
	requestQ4 = "f4051627-3d4e-4f50-b162-738495a6b7c8"
	requestQ5 = "05162738-4e5f-4061-8273-8495a6b7c8d9"
)

// sendQuoting posts a text that replies to a message of the ticket.
func (e *testEnv) sendQuoting(ticketID int64, token, requestID, body string, quoted int64) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token,
		map[string]any{"clientRequestId": requestID, "body": body, "quotedMessageId": quoted})
}

// sendFileQuoting posts a file (or, with field "voice", a recording) that
// replies to a message of the ticket.
func (e *testEnv) sendFileQuoting(ticketID int64, token, requestID, field, name, mimeType string, data []byte, caption, quoted string) response {
	e.T.Helper()
	return e.sendForm(ticketID, token, requestID, field, name, mimeType, data, caption, map[string]string{"quotedMessageId": quoted})
}

// apiQuote returns the quote of the message as the messages API shows it; nil when null.
func (e *testEnv) apiQuote(ticketID, messageID int64, token string) map[string]any {
	e.T.Helper()
	for _, m := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token) {
		if m["id"] == float64(messageID) {
			q, _ := m["quote"].(map[string]any)
			return q
		}
	}
	e.T.Fatalf("message %d not in the API", messageID)
	return nil
}

// lastSentQuote returns the quote of the last message handed to the provider.
func (e *testEnv) lastSentQuote() *messaging.Quote {
	e.T.Helper()
	sent := e.WhatsApp.SentMessages()
	if len(sent) == 0 {
		e.T.Fatal("nothing sent to the provider")
	}
	switch m := sent[len(sent)-1].(type) {
	case messaging.TextMessage:
		return m.Quote
	case messaging.MediaMessage:
		return m.Quote
	default:
		e.T.Fatalf("last sent = %+v", m)
		return nil
	}
}

func wantSentQuote(t *testing.T, got *messaging.Quote, want messaging.Quote) {
	t.Helper()
	if got == nil || !reflect.DeepEqual(*got, want) {
		t.Fatalf("quote sent to the provider = %+v (snippet %+v), want %+v (snippet %+v)", got, snippetOf(got), want, want.Snippet)
	}
}

func snippetOf(q *messaging.Quote) *messaging.QuoteSnippet {
	if q == nil {
		return nil
	}
	return q.Snippet
}

func quoteSnippet(typ messaging.MessageType, text string) *messaging.QuoteSnippet {
	return &messaging.QuoteSnippet{Type: typ, Text: text}
}

// Texto, arquivo com legenda e áudio respondem citando uma mensagem do
// chamado: o provedor recebe a citação (identificador, quem enviou a citada e
// trecho), e a mensagem gravada traz a citação ligada, com o apelido como nas
// demais.
func TestAssigneeRepliesQuotingAMessageOfTheTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	contact := "5511988887777@s.whatsapp.net"
	const phone = "5511988887777"
	pdf := []byte("%PDF-1.7 contrato")
	doc := text("IN-DOC", contact, phone, "")
	doc.Type, doc.Media = messaging.TypeDocument, &messaging.Media{Data: pdf, MimeType: "application/pdf", FileName: "contrato.pdf"}
	e.receive(c.sector.ID, doc)
	unavailable := text("IN-UNAV", contact, phone, "planilha.xlsx")
	unavailable.Type = messaging.TypeMediaUnavailable
	e.receive(c.sector.ID, unavailable)
	inbound := e.messages(c.ticket.ID)
	if len(inbound) != 3 {
		t.Fatalf("received messages = %+v", inbound)
	}
	greeting, docMsg, unavailableMsg := inbound[0], inbound[1], inbound[2]

	// Texto citando a mensagem do cliente.
	r := e.sendQuoting(c.ticket.ID, c.anaToken, requestQ1, "Bom dia, já vejo", greeting.ID)
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("text quoting: status %d, body %v", r.Status, r.Body)
	}
	reply := id(r.Body)
	if m := e.WhatsApp.SentMessages()[0].(messaging.TextMessage); m.Body != "*ana@exemplo.com:*\nBom dia, já vejo" {
		t.Fatalf("text sent = %+v", m)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{ExternalMessageID: "MSG-1", Snippet: quoteSnippet(messaging.TypeText, "Olá")})
	wantQuote(t, e.apiQuote(c.ticket.ID, reply, c.biaToken), float64(greeting.ID), "text", "Olá")

	// Arquivo com legenda citando a mensagem que o próprio setor enviou.
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
	r = e.sendFileQuoting(c.ticket.ID, c.anaToken, requestQ2, "file", "foto.png", "image/png", png, "Segue a foto", strconv.FormatInt(reply, 10))
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("file quoting: status %d, body %v", r.Status, r.Body)
	}
	image := id(r.Body)
	if m := e.WhatsApp.SentMessages()[1].(messaging.MediaMessage); m.Type != messaging.TypeImage || m.Caption != "*ana@exemplo.com:*\nSegue a foto" {
		t.Fatalf("file sent = type %s, caption %q", m.Type, m.Caption)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{
		ExternalMessageID: "fake-msg-" + requestQ1, FromSector: true,
		Snippet: quoteSnippet(messaging.TypeText, "*ana@exemplo.com:*\nBom dia, já vejo"),
	})
	wantQuote(t, e.apiQuote(c.ticket.ID, image, c.anaToken), float64(reply), "text", "*ana@exemplo.com:*\nBom dia, já vejo")

	// Áudio gravado citando um documento: sai sem apelido, e a citação mostra o nome do arquivo.
	r = e.sendFileQuoting(c.ticket.ID, c.anaToken, requestQ3, "voice", "gravacao.webm", "audio/webm;codecs=opus", recordWebM(t, 1), "", strconv.FormatInt(docMsg.ID, 10))
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("voice quoting: status %d, body %v", r.Status, r.Body)
	}
	voice := id(r.Body)
	if m := e.WhatsApp.SentMessages()[2].(messaging.MediaMessage); m.Type != messaging.TypeAudio || m.Caption != "" {
		t.Fatalf("voice sent = type %s, caption %q", m.Type, m.Caption)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{ExternalMessageID: "IN-DOC", Snippet: quoteSnippet(messaging.TypeDocument, "contrato.pdf")})
	wantQuote(t, e.apiQuote(c.ticket.ID, voice, c.anaToken), float64(docMsg.ID), "document", "contrato.pdf")

	// Citar um áudio não leva texto; citar o arquivo indisponível continua permitido.
	r = e.sendQuoting(c.ticket.ID, c.anaToken, requestQ4, "Ouvi seu áudio", voice)
	if r.Status != http.StatusOK {
		t.Fatalf("quoting audio: status %d, body %v", r.Status, r.Body)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{ExternalMessageID: "fake-msg-" + requestQ3, FromSector: true, Snippet: quoteSnippet(messaging.TypeAudio, "")})
	wantQuote(t, e.apiQuote(c.ticket.ID, id(r.Body), c.anaToken), float64(voice), "audio", nil)

	r = e.sendQuoting(c.ticket.ID, c.anaToken, requestQ5, "Pode reenviar a planilha?", unavailableMsg.ID)
	if r.Status != http.StatusOK {
		t.Fatalf("quoting unavailable media: status %d, body %v", r.Status, r.Body)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{ExternalMessageID: "IN-UNAV", Snippet: quoteSnippet(messaging.TypeMediaUnavailable, "planilha.xlsx")})
	wantQuote(t, e.apiQuote(c.ticket.ID, id(r.Body), c.anaToken), float64(unavailableMsg.ID), "media_unavailable", "planilha.xlsx")

	// O texto gravado é o mesmo enviado, com o apelido; o áudio fica sem texto.
	got := e.outbound(c.ticket.ID)
	want := []string{"*ana@exemplo.com:*\nBom dia, já vejo", "*ana@exemplo.com:*\nSegue a foto", "<nil>", "*ana@exemplo.com:*\nOuvi seu áudio", "*ana@exemplo.com:*\nPode reenviar a planilha?"}
	if len(got) != len(want) {
		t.Fatalf("outbound = %+v", got)
	}
	for i, m := range got {
		if str(m.Body) != want[i] {
			t.Fatalf("message %d body = %q, want %q", i, str(m.Body), want[i])
		}
	}

	// Mensagem sem citação continua saindo sem ela.
	if r := e.sendText(c.ticket.ID, c.anaToken, "16273849-5f60-4172-9384-95a6b7c8d9ea", "Sem citação"); r.Status != http.StatusOK {
		t.Fatalf("plain text: status %d", r.Status)
	}
	if q := e.lastSentQuote(); q != nil {
		t.Fatalf("plain text sent with quote %+v", q)
	}
}

// Só mensagens do chamado atual que o WhatsApp conhece, e que não são exibidas
// como não suportadas, podem ser citadas; o resto é recusado sem gravar nem
// enviar nada. Só o responsável cita, com o chamado aberto.
func TestQuoteOutsideWhatCanBeQuotedIsRefused(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	contact := "5511988887777@s.whatsapp.net"
	const phone = "5511988887777"
	sticker := text("IN-STICKER", contact, phone, "")
	sticker.Type = messaging.TypeUnsupported
	e.receive(c.sector.ID, sticker)
	stickerMsg := e.messages(c.ticket.ID)[1]
	greeting := e.messages(c.ticket.ID)[0]

	// Mensagem com falha e mensagem ainda enviando.
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	failed := e.sendText(c.ticket.ID, c.anaToken, requestA, "Vai falhar")
	if failed.Status != http.StatusOK || failed.Body["status"] != "failed" {
		t.Fatalf("failed message: status %d, body %v", failed.Status, failed.Body)
	}
	pending := e.sendText(c.ticket.ID, c.anaToken, requestB, "Fica enviando")
	if _, err := e.Pool.Exec(t.Context(), "update messages set status = 'pending', failure_reason = null where id = $1", id(pending.Body)); err != nil {
		t.Fatal(err)
	}
	e.connectSector(c.sector.ID)

	// Mensagem de outro chamado (outro contato do mesmo setor), já com identificador no WhatsApp.
	other := e.queuedTicket(c.sector.ID, "OTHER-1", "5511977776666")
	otherMsg := e.messages(other.ID)[0]

	before := len(e.outbound(c.ticket.ID))
	refused := map[string]int64{
		"message of another ticket": otherMsg.ID,
		"unknown message":           999999,
		"failed message":            id(failed.Body),
		"pending message":           id(pending.Body),
		"unsupported message":       stickerMsg.ID,
	}
	for name, quoted := range refused {
		if r := e.sendQuoting(c.ticket.ID, c.anaToken, requestC, "Citando", quoted); r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("text quoting %s: status %d, body %v", name, r.Status, r.Body)
		}
		r := e.sendFileQuoting(c.ticket.ID, c.anaToken, requestC, "file", "nota.pdf", "application/pdf", []byte("%PDF"), "", strconv.FormatInt(quoted, 10))
		if r.Status != http.StatusUnprocessableEntity {
			t.Fatalf("file quoting %s: status %d, body %v", name, r.Status, r.Body)
		}
	}
	if r := e.sendFileQuoting(c.ticket.ID, c.anaToken, requestC, "file", "nota.pdf", "application/pdf", []byte("%PDF"), "", "abc"); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid quoted id: status %d", r.Status)
	}

	// Quem não é o responsável não cita, nem mensagem válida.
	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		if r := e.sendQuoting(c.ticket.ID, token, requestC, "Citando", greeting.ID); r.Status != http.StatusForbidden {
			t.Fatalf("quoting by %s: status %d", name, r.Status)
		}
	}
	if got := len(e.outbound(c.ticket.ID)); got != before {
		t.Fatalf("refused quotes recorded messages: %d, want %d", got, before)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("refused quotes reached WhatsApp: %+v", sent)
	}

	// Encerrado, nem o responsável cita.
	e.closeTicket(c.ticket.ID, c.ana.ID, e.Organization(c.supToken, "Prefeitura", ""))
	if r := e.sendQuoting(c.ticket.ID, c.anaToken, requestC, "Citando", greeting.ID); r.Status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", r.Status)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("closed ticket reached WhatsApp: %+v", sent)
	}
}

// "Reenviar" repete a mesma citação, sem duplicar no WhatsApp, e o pedido
// repetido devolve a mensagem gravada sem enviar de novo nem trocar a citação.
func TestRetryAndRepeatedRequestKeepTheQuote(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	greeting := e.messages(c.ticket.ID)[0]
	e.receive(c.sector.ID, text("IN-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outra pergunta"))
	second := e.messages(c.ticket.ID)[1]

	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	r := e.sendQuoting(c.ticket.ID, c.anaToken, requestA, "Segue a resposta", greeting.ID)
	if r.Status != http.StatusOK || r.Body["status"] != "failed" {
		t.Fatalf("send while disconnected: status %d, body %v", r.Status, r.Body)
	}
	msgID := id(r.Body)
	// A citação fica gravada mesmo com a falha.
	wantQuote(t, e.apiQuote(c.ticket.ID, msgID, c.anaToken), float64(greeting.ID), "text", "Olá")

	// Pedido repetido com outra citação devolve a mesma mensagem, sem trocar a citação.
	if r := e.sendQuoting(c.ticket.ID, c.anaToken, requestA, "Segue a resposta", second.ID); r.Status != http.StatusOK || id(r.Body) != msgID {
		t.Fatalf("repeated request: status %d, body %v", r.Status, r.Body)
	}
	wantQuote(t, e.apiQuote(c.ticket.ID, msgID, c.anaToken), float64(greeting.ID), "text", "Olá")

	e.connectSector(c.sector.ID)
	retryPath := fmt.Sprintf("/api/messages/%d/retry", msgID)
	if r := e.Do(http.MethodPost, retryPath, c.anaToken, nil); r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("retry: status %d, body %v", r.Status, r.Body)
	}
	sent := e.WhatsApp.SentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	m := sent[0].(messaging.TextMessage)
	if m.IdempotencyKey != requestA || m.Body != "*ana@exemplo.com:*\nSegue a resposta" {
		t.Fatalf("retried message = %+v", m)
	}
	wantSentQuote(t, m.Quote, messaging.Quote{ExternalMessageID: "MSG-1", Snippet: quoteSnippet(messaging.TypeText, "Olá")})

	// Repetir depois do envio não reenvia.
	if r := e.sendQuoting(c.ticket.ID, c.anaToken, requestA, "Segue a resposta", greeting.ID); r.Status != http.StatusOK || id(r.Body) != msgID {
		t.Fatalf("repeated after sending: status %d, body %v", r.Status, r.Body)
	}
	if r := e.Do(http.MethodPost, retryPath, c.anaToken, nil); r.Status != http.StatusConflict {
		t.Fatalf("retry of a sent message: status %d", r.Status)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 1 {
		t.Fatalf("resent: %+v", sent)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 || got[0].Status == nil || *got[0].Status != string(db.MessageStatusSent) {
		t.Fatalf("outbound = %+v", got)
	}
}
