package helpdesk_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"reflect"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const (
	requestC1 = "a1b2c3d4-1111-4a2b-8c3d-111111111111"
	requestC2 = "a1b2c3d4-2222-4a2b-8c3d-222222222222"
	requestC3 = "a1b2c3d4-3333-4a2b-8c3d-333333333333"
	requestC4 = "a1b2c3d4-4444-4a2b-8c3d-444444444444"
	requestC5 = "a1b2c3d4-5555-4a2b-8c3d-555555555555"
)

// sendContact asks to send a contact of the directory as a card, quoting a
// message when quoted is not zero.
func (e *testEnv) sendContact(ticketID int64, token, requestID string, contactID, quoted int64) response {
	e.T.Helper()
	body := map[string]any{"clientRequestId": requestID, "contactId": contactID}
	if quoted != 0 {
		body["quotedMessageId"] = quoted
	}
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/messages/contact", ticketID), token, body)
}

// recordedCards returns the cards recorded in the message, as the column keeps them.
func (e *testEnv) recordedCards(messageID int64) any {
	e.T.Helper()
	var raw []byte
	if err := e.Pool.QueryRow(e.T.Context(), `select contact_cards from messages where id = $1`, messageID).Scan(&raw); err != nil {
		e.T.Fatalf("message %d: %v", messageID, err)
	}
	if raw == nil {
		return nil
	}
	var cards any
	if err := json.Unmarshal(raw, &cards); err != nil {
		e.T.Fatal(err)
	}
	return cards
}

// apiCards returns the cards of the message as the messages API shows them.
func (e *testEnv) apiCards(ticketID, messageID int64, token string) any {
	e.T.Helper()
	for _, m := range e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", ticketID), token) {
		if m["id"] == float64(messageID) {
			return m["contactCards"]
		}
	}
	e.T.Fatalf("message %d not in the API", messageID)
	return nil
}

// sentContacts returns the cards handed to the provider, in order.
func (e *testEnv) sentContacts() []messaging.ContactMessage {
	e.T.Helper()
	var out []messaging.ContactMessage
	for _, m := range e.WhatsApp.SentMessages() {
		if c, ok := m.(messaging.ContactMessage); ok {
			out = append(out, c)
		}
	}
	return out
}

// carla is a registered contact of the directory, in Prefeitura de Itu.
func (c conversation) carla() int64 {
	c.e.T.Helper()
	org := c.e.OrganizationIn(c.supToken, "Prefeitura de Itu", "", "Itu")
	return c.e.Contact(c.supToken, "Carla Souza", "5511977776666", org, c.sector.ID)
}

var carlaCard = messaging.ContactCard{
	Name:         "Carla Souza",
	Phones:       []messaging.ContactPhone{{Phone: "5511977776666"}},
	Organization: "Prefeitura de Itu — Itu",
}

const carlaStored = `[{"name": "Carla Souza", "organization": "Prefeitura de Itu — Itu", "phones": [{"phone": "5511977776666", "wa_id": null}]}]`

// O responsável envia um contato do cadastro como cartão: o provedor recebe
// nome, telefone e órgão com o município, sem apelido, e a mensagem fica
// gravada como contact, com quem enviou e o cartão. Mudar o cadastro depois não
// muda o cartão gravado.
func TestAssigneeSendsARegisteredContactAsCard(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	carla := c.carla()

	r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0)
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("send contact: status %d, body %v", r.Status, r.Body)
	}
	msgID := id(r.Body)

	sent := e.WhatsApp.SentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	want := messaging.ContactMessage{
		SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net", Card: carlaCard, IdempotencyKey: requestC1,
	}
	if got, ok := sent[0].(messaging.ContactMessage); !ok || !reflect.DeepEqual(got, want) {
		t.Fatalf("card sent = %#v\nwant %#v", sent[0], want)
	}

	got := e.outbound(c.ticket.ID)
	if len(got) != 1 {
		t.Fatalf("outbound = %+v", got)
	}
	m := got[0]
	if m.ID != msgID || m.Type != "contact" || m.Origin != "agent" || m.AuthorID == nil || *m.AuthorID != c.ana.ID ||
		m.Body != nil || str(m.Status) != "sent" || str(m.ExternalMessageID) != "fake-msg-"+requestC1 {
		t.Fatalf("recorded message = %+v", m)
	}
	if cards := e.recordedCards(msgID); !reflect.DeepEqual(cards, jsonValue(t, carlaStored)) {
		t.Fatalf("recorded cards = %v", cards)
	}
	apiWant := jsonValue(t, `[{"name": "Carla Souza", "organization": "Prefeitura de Itu — Itu", "phones": [{"phone": "5511977776666", "whatsAppId": null}]}]`)
	if cards := e.apiCards(c.ticket.ID, msgID, c.biaToken); !reflect.DeepEqual(cards, apiWant) {
		t.Fatalf("API cards = %v", cards)
	}

	// O cadastro muda (nome, telefone e órgão), e o cartão enviado fica como saiu.
	other := e.OrganizationIn(c.supToken, "Câmara de Campinas", "", "Campinas")
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", carla), c.supToken, map[string]any{
		"name": "Carla Souza Lima", "phone": "5519966665555", "organizationId": other, "sectorIds": []int64{c.sector.ID},
	}); resp.Status != http.StatusOK {
		t.Fatalf("update contact: status %d, body %v", resp.Status, resp.Body)
	}
	if cards := e.recordedCards(msgID); !reflect.DeepEqual(cards, jsonValue(t, carlaStored)) {
		t.Fatalf("recorded cards after the registration changed = %v", cards)
	}
	if cards := e.apiCards(c.ticket.ID, msgID, c.anaToken); !reflect.DeepEqual(cards, apiWant) {
		t.Fatalf("API cards after the registration changed = %v", cards)
	}

	// O próximo envio leva o cadastro novo.
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC2, carla, 0); r.Status != http.StatusOK {
		t.Fatalf("second send: status %d, body %v", r.Status, r.Body)
	}
	cards := e.sentContacts()
	if len(cards) != 2 || cards[1].Card.Name != "Carla Souza Lima" || cards[1].Card.Organization != "Câmara de Campinas — Campinas" ||
		len(cards[1].Card.Phones) != 1 || cards[1].Card.Phones[0].Phone != "5519966665555" {
		t.Fatalf("second card = %+v", cards)
	}
}

// Quem não é o responsável, chamado encerrado, contato não cadastrado, sem
// telefone ou inexistente: recusado sem gravar nem chamar o provedor.
func TestContactCardOutsideTheRulesIsRefused(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	carla := c.carla()

	// Na fila, sem responsável.
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0); r.Status != http.StatusForbidden {
		t.Fatalf("queued ticket: status %d", r.Status)
	}
	c.assign()
	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		if r := e.sendContact(c.ticket.ID, token, requestC1, carla, 0); r.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, r.Status)
		}
	}
	if r := e.sendContact(c.ticket.ID, "", requestC1, carla, 0); r.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", r.Status)
	}

	// O contato do próprio chamado veio de um número desconhecido: não está cadastrado.
	unregistered := c.ticket.ContactID
	// Um contato conhecido só pela conta do WhatsApp, sem telefone.
	e.receive(c.sector.ID, text("LID-1", "123456789012345@lid", "", "Oi"))
	var withoutPhone int64
	if err := e.Pool.QueryRow(t.Context(), `select id from contacts where external_contact_id = '123456789012345@lid'`).Scan(&withoutPhone); err != nil {
		t.Fatal(err)
	}
	for name, contactID := range map[string]int64{"unregistered": unregistered, "without phone": withoutPhone} {
		r := e.sendContact(c.ticket.ID, c.anaToken, requestC2, contactID, 0)
		if r.Status != http.StatusUnprocessableEntity || r.Body["error"] != "Só é possível enviar contatos cadastrados com telefone." {
			t.Fatalf("%s: status %d, body %v", name, r.Status, r.Body)
		}
	}
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC3, 999999, 0); r.Status != http.StatusUnprocessableEntity || r.Body["error"] != "Contato não encontrado." {
		t.Fatalf("unknown contact: status %d, body %v", r.Status, r.Body)
	}
	// Sem contato ou com identificador inválido.
	if r := e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/messages/contact", c.ticket.ID), c.anaToken,
		map[string]any{"clientRequestId": requestC3}); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("without contact: status %d", r.Status)
	}
	if r := e.sendContact(c.ticket.ID, c.anaToken, "abc", carla, 0); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("invalid request id: status %d", r.Status)
	}

	// Encerrado, nem o responsável envia.
	e.closeTicket(c.ticket.ID, c.ana.ID, e.Organization(c.supToken, "Prefeitura", ""))
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC4, carla, 0); r.Status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", r.Status)
	}

	if got := e.outbound(c.ticket.ID); len(got) != 0 {
		t.Fatalf("refused cards recorded messages: %+v", got)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("refused cards reached WhatsApp: %+v", sent)
	}
}

// Com o número desconectado o cartão fica com falha; "Reenviar" repete o
// mesmo cartão com a mesma chave, sem duplicar, e repetir a requisição não
// cria outra mensagem.
func TestContactCardFailsAndIsRetriedOnce(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	carla := c.carla()

	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0)
	if r.Status != http.StatusOK || r.Body["status"] != "failed" || r.Body["failureReason"] != "Número do setor desconectado." {
		t.Fatalf("send while disconnected: status %d, body %v", r.Status, r.Body)
	}
	msgID := id(r.Body)
	if cards := e.recordedCards(msgID); !reflect.DeepEqual(cards, jsonValue(t, carlaStored)) {
		t.Fatalf("failed message cards = %v", cards)
	}

	// Repetir a requisição devolve a mesma mensagem, sem gravar outra.
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0); r.Status != http.StatusOK || id(r.Body) != msgID {
		t.Fatalf("repeated request: status %d, body %v", r.Status, r.Body)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 {
		t.Fatalf("outbound after repeating = %+v", got)
	}

	// O cadastro muda antes do reenvio: o reenvio leva o cartão gravado.
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", carla), c.supToken, map[string]any{
		"name": "Outro Nome", "phone": "5511977776666", "organizationId": e.Organization(c.supToken, "Câmara", ""), "sectorIds": []int64{c.sector.ID},
	}); resp.Status != http.StatusOK {
		t.Fatalf("update contact: status %d, body %v", resp.Status, resp.Body)
	}

	e.connectSector(c.sector.ID)
	retryPath := fmt.Sprintf("/api/messages/%d/retry", msgID)
	if r := e.Do(http.MethodPost, retryPath, c.anaToken, nil); r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("retry: status %d, body %v", r.Status, r.Body)
	}
	// Uma segunda tentativa com a mesma chave não duplica no provedor.
	if _, err := e.WhatsApp.SendContact(t.Context(), messaging.ContactMessage{SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net", Card: carlaCard, IdempotencyKey: requestC1}); err != nil {
		t.Fatal(err)
	}
	sent := e.sentContacts()
	if len(sent) != 1 || sent[0].IdempotencyKey != requestC1 || !reflect.DeepEqual(sent[0].Card, carlaCard) {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	if r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0); r.Status != http.StatusOK || id(r.Body) != msgID || r.Body["status"] != "sent" {
		t.Fatalf("repeated after sending: status %d, body %v", r.Status, r.Body)
	}
	if r := e.Do(http.MethodPost, retryPath, c.anaToken, nil); r.Status != http.StatusConflict {
		t.Fatalf("retry of a sent card: status %d", r.Status)
	}
	if sent := e.sentContacts(); len(sent) != 1 {
		t.Fatalf("resent: %+v", sent)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 || str(got[0].Status) != string(db.MessageStatusSent) {
		t.Fatalf("outbound = %+v", got)
	}
}

// A consulta do WhatsApp que o envio faz (a conta do telefone do cartão)
// falha: o cartão fica com falha, gravado, e "Reenviar" leva o mesmo cartão
// com a mesma chave, sem duplicar.
func TestContactCardFailsOnAProviderErrorAndIsRetried(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	carla := c.carla()

	e.WhatsApp.FailNextSend(c.sector.ID, errors.New("is on whatsapp: websocket not connected"))
	r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0)
	if r.Status != http.StatusOK || r.Body["status"] != "failed" || r.Body["failureReason"] != "O WhatsApp não aceitou a mensagem." {
		t.Fatalf("send with the query failing: status %d, body %v", r.Status, r.Body)
	}
	msgID := id(r.Body)
	if sent := e.sentContacts(); len(sent) != 0 {
		t.Fatalf("sent to WhatsApp after the failure = %+v", sent)
	}
	if cards := e.recordedCards(msgID); !reflect.DeepEqual(cards, jsonValue(t, carlaStored)) {
		t.Fatalf("failed message cards = %v", cards)
	}

	if r := e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", msgID), c.anaToken, nil); r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("retry: status %d, body %v", r.Status, r.Body)
	}
	sent := e.sentContacts()
	if len(sent) != 1 || sent[0].IdempotencyKey != requestC1 || !reflect.DeepEqual(sent[0].Card, carlaCard) {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	if got := e.outbound(c.ticket.ID); len(got) != 1 || got[0].ID != msgID || str(got[0].Status) != string(db.MessageStatusSent) {
		t.Fatalf("outbound = %+v", got)
	}
}

// O cartão sai como resposta citada, e o responsável cita um cartão do
// chamado, enviado ou recebido: o trecho é contact com o nome do primeiro cartão.
func TestContactCardIsQuotedBothWays(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	carla := c.carla()
	greeting := e.messages(c.ticket.ID)[0]

	// Cartão como resposta citada.
	r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, greeting.ID)
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("card quoting: status %d, body %v", r.Status, r.Body)
	}
	card := id(r.Body)
	sent := e.sentContacts()
	if len(sent) != 1 {
		t.Fatalf("sent = %+v", sent)
	}
	wantSentQuote(t, sent[0].Quote, messaging.Quote{ExternalMessageID: "MSG-1", Snippet: quoteSnippet(messaging.TypeText, "Olá")})
	wantQuote(t, e.apiQuote(c.ticket.ID, card, c.anaToken), float64(greeting.ID), "text", "Olá")

	// Citar o cartão enviado.
	r = e.sendQuoting(c.ticket.ID, c.anaToken, requestC2, "Esse é o contato da Carla", card)
	if r.Status != http.StatusOK {
		t.Fatalf("quoting the sent card: status %d, body %v", r.Status, r.Body)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{
		ExternalMessageID: "fake-msg-" + requestC1, FromSector: true, Snippet: quoteSnippet(messaging.TypeContact, "Carla Souza"),
	})
	wantQuote(t, e.apiQuote(c.ticket.ID, id(r.Body), c.anaToken), float64(card), "contact", "Carla Souza")

	// Citar um cartão recebido, com vários contatos: o nome do primeiro.
	e.receive(c.sector.ID, contactMessage("IN-CT",
		messaging.ContactCard{Name: "João Silva", Phones: []messaging.ContactPhone{{Phone: "5511955554444"}}},
		messaging.ContactCard{Name: "Maria", Phones: []messaging.ContactPhone{{Phone: "5511944443333"}}},
	))
	received := e.messageID(c.ticket.ID, "IN-CT")
	r = e.sendQuoting(c.ticket.ID, c.anaToken, requestC3, "Recebi os contatos", received)
	if r.Status != http.StatusOK {
		t.Fatalf("quoting the received card: status %d, body %v", r.Status, r.Body)
	}
	wantSentQuote(t, e.lastSentQuote(), messaging.Quote{ExternalMessageID: "IN-CT", Snippet: quoteSnippet(messaging.TypeContact, "João Silva")})
	wantQuote(t, e.apiQuote(c.ticket.ID, id(r.Body), c.anaToken), float64(received), "contact", "João Silva")

	// Um cartão citando outro cartão.
	r = e.sendContact(c.ticket.ID, c.anaToken, requestC4, carla, received)
	if r.Status != http.StatusOK {
		t.Fatalf("card quoting a card: status %d, body %v", r.Status, r.Body)
	}
	sent = e.sentContacts()
	wantSentQuote(t, sent[len(sent)-1].Quote, messaging.Quote{ExternalMessageID: "IN-CT", Snippet: quoteSnippet(messaging.TypeContact, "João Silva")})

	// O cliente cita o cartão enviado: a citação gravada é contact com o nome.
	reply := text("IN-Q", cardContact, cardPhone, "Obrigado")
	reply.Quote = &messaging.Quote{ExternalMessageID: "fake-msg-" + requestC1, Snippet: quoteSnippet(messaging.TypeContact, "Carla Souza")}
	e.receive(c.sector.ID, reply)
	replyID := e.messageID(c.ticket.ID, "IN-Q")
	wantQuote(t, e.apiQuote(c.ticket.ID, replyID, c.anaToken), float64(card), "contact", "Carla Souza")

	// Um cartão que ainda não saiu (com falha) não pode ser citado.
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	failed := e.sendContact(c.ticket.ID, c.anaToken, requestC5, carla, 0)
	if failed.Status != http.StatusOK || failed.Body["status"] != "failed" {
		t.Fatalf("failed card: status %d, body %v", failed.Status, failed.Body)
	}
	e.connectSector(c.sector.ID)
	if r := e.sendQuoting(c.ticket.ID, c.anaToken, "a1b2c3d4-6666-4a2b-8c3d-666666666666", "Oi", id(failed.Body)); r.Status != http.StatusUnprocessableEntity {
		t.Fatalf("quoting a failed card: status %d", r.Status)
	}
}

// O cartão de contato é excluído como as outras mensagens, para todos (também
// no WhatsApp) ou só no XET, mas nunca editado: o backend recusa a edição, como
// recusa a do áudio, mesmo que a tela seja contornada.
func TestContactCardIsDeletedButNeverEdited(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	carla := c.carla()

	r := e.sendContact(c.ticket.ID, c.anaToken, requestC1, carla, 0)
	if r.Status != http.StatusOK || r.Body["status"] != "sent" {
		t.Fatalf("send contact: status %d, body %v", r.Status, r.Body)
	}
	everyone := id(r.Body)

	// Editar é recusado antes de qualquer ida ao WhatsApp.
	if r := e.editMessage(everyone, c.anaToken, requestE1, "João"); r.Status != http.StatusConflict ||
		r.Body["error"] != "Contato não pode ser editado." {
		t.Fatalf("edit of a contact card: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 0 {
		t.Fatalf("changes sent after the refused edit = %+v", got)
	}

	// Excluir para todos vai ao WhatsApp e mantém o cartão guardado.
	if r := e.deleteMessage(everyone, c.anaToken, requestE2, "everyone"); r.Status != http.StatusOK ||
		r.Body["deletion"].(map[string]any)["scope"] != "everyone" {
		t.Fatalf("delete the card for everyone: status %d, body %v", r.Status, r.Body)
	}
	want := []any{messaging.MessageRevoke{
		SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net",
		TargetExternalMessageID: "fake-msg-" + requestC1, IdempotencyKey: requestE2,
	}}
	if got := e.sentChanges(); !reflect.DeepEqual(got, want) {
		t.Fatalf("changes sent:\ngot  %+v\nwant %+v", got, want)
	}
	if cards := e.recordedCards(everyone); !reflect.DeepEqual(cards, jsonValue(t, carlaStored)) {
		t.Fatalf("cards kept after deletion = %v", cards)
	}

	// Um segundo cartão: "Excluir para mim" oculta sem chamar o WhatsApp.
	second := e.sendContact(c.ticket.ID, c.anaToken, requestC3, carla, 0)
	if second.Status != http.StatusOK || second.Body["status"] != "sent" {
		t.Fatalf("send second contact: status %d, body %v", second.Status, second.Body)
	}
	if r := e.deleteMessage(id(second.Body), c.anaToken, requestE3, "local"); r.Status != http.StatusOK ||
		r.Body["deletion"].(map[string]any)["scope"] != "local" {
		t.Fatalf("delete the card for me: status %d, body %v", r.Status, r.Body)
	}
	if got := e.sentChanges(); len(got) != 1 {
		t.Fatalf("changes sent after a local deletion = %+v", got)
	}

	// Excluído, o cartão não é mais editado por nenhum caminho.
	if r := e.editMessage(everyone, c.anaToken, requestE4, "João"); r.Status != http.StatusConflict ||
		r.Body["error"] != "Esta mensagem já foi excluída." {
		t.Fatalf("edit of a deleted card: status %d, body %v", r.Status, r.Body)
	}
}
