package helpdesk_test

import (
	"fmt"
	"net/http"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

// reactTo asks for the reaction of the sector to the message, as the panel does.
func (e *testEnv) reactTo(messageID int64, token, emoji string) response {
	e.T.Helper()
	return e.Do(http.MethodPut, fmt.Sprintf("/api/messages/%d/reaction", messageID), token, map[string]string{"emoji": emoji})
}

// sentReactions returns the reactions handed to the provider, in order.
func (e *testEnv) sentReactions() []messaging.Reaction {
	e.T.Helper()
	var out []messaging.Reaction
	for _, m := range e.WhatsApp.SentMessages() {
		if r, ok := m.(messaging.Reaction); ok {
			out = append(out, r)
		}
	}
	return out
}

func (e *testEnv) messageID(ticketID int64, externalID string) int64 {
	e.T.Helper()
	for _, m := range e.messages(ticketID) {
		if m.ExternalMessageID != nil && *m.ExternalMessageID == externalID {
			return m.ID
		}
	}
	e.T.Fatalf("message %s not in ticket %d", externalID, ticketID)
	return 0
}

// sectorReaction returns the emoji and the agent the sector side shows for
// the message, as the messages API of the ticket shows them.
func (c conversation) sectorReaction(externalID string) (emoji, by string, viaPhone bool) {
	c.e.T.Helper()
	side, ok := c.e.reactionsOf(c.ticket.ID, c.anaToken, externalID)["sector"].(map[string]any)
	if !ok {
		return "", "", false
	}
	if ref, ok := side["by"].(map[string]any); ok {
		by = ref["name"].(string)
	}
	return side["emoji"].(string), by, side["viaPhone"].(bool)
}

// reactionConversation is an assigned conversation with a received message
// (MSG-1), one sent from the panel and one sent from the phone of the sector
// (OUT-1), all known to WhatsApp.
type reactionConversation struct {
	conversation
	sentID string
}

func newReactionConversation(t *testing.T) reactionConversation {
	t.Helper()
	c := newConversation(t)
	c.assign()
	if resp := c.e.sendText(c.ticket.ID, c.anaToken, requestA, "Bom dia"); resp.Status != http.StatusOK || resp.Body["status"] != "sent" {
		t.Fatalf("send: status %d, body %v", resp.Status, resp.Body)
	}
	c.e.sendOutside(c.sector.ID, text("OUT-1", "5511988887777@s.whatsapp.net", "5511988887777", "Pelo celular"))
	return reactionConversation{conversation: c, sentID: "fake-msg-" + requestA}
}

func TestAssigneeReactsToReceivedAndSentMessages(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e

	cases := []struct {
		external   string
		emoji      string
		fromSector bool
	}{
		{"MSG-1", "👍", false},
		{c.sentID, "❤️", true},
		{"OUT-1", "👩🏽\u200d💻", true},
	}
	for _, tc := range cases {
		resp := e.reactTo(e.messageID(c.ticket.ID, tc.external), c.anaToken, tc.emoji)
		if resp.Status != http.StatusOK || resp.Body["emoji"] != tc.emoji {
			t.Fatalf("react to %s: status %d, body %v", tc.external, resp.Status, resp.Body)
		}
		if emoji, by, viaPhone := c.sectorReaction(tc.external); emoji != tc.emoji || by != "ana@exemplo.com" || viaPhone {
			t.Fatalf("sector reaction of %s = %q by %q (via phone %v)", tc.external, emoji, by, viaPhone)
		}
	}

	// A reação sai sem apelido, para o contato do chamado, apontando a mensagem pelo identificador do WhatsApp.
	want := make([]messaging.Reaction, len(cases))
	for i, tc := range cases {
		want[i] = messaging.Reaction{
			SectorID: c.sector.ID, To: "5511988887777@s.whatsapp.net", TargetExternalMessageID: tc.external,
			TargetFromSector: tc.fromSector, Emoji: tc.emoji,
		}
	}
	if got := e.sentReactions(); !reflect.DeepEqual(got, want) {
		t.Fatalf("reactions sent to WhatsApp:\ngot  %+v\nwant %+v", got, want)
	}
	// A reação não é mensagem: nada novo na conversa.
	if got := e.messages(c.ticket.ID); len(got) != 3 {
		t.Fatalf("messages = %+v", got)
	}
	// Quem vê a conversa vê a reação e quem reagiu.
	side := e.reactionsOf(c.ticket.ID, c.biaToken, "MSG-1")["sector"].(map[string]any)
	if side["emoji"] != "👍" || side["by"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("reaction seen by another agent = %v", side)
	}
}

func TestSectorReactionIsReplacedAndTheSameEmojiRemovesIt(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e
	msg := e.messageID(c.ticket.ID, "MSG-1")

	for _, step := range []struct {
		emoji, want string
	}{
		{"👍", "👍"},
		{"😂", "😂"}, // outro emoji substitui
		{"😂", ""},  // o mesmo emoji remove
		{"🙏", "🙏"}, // depois de removida, reage de novo
	} {
		resp := e.reactTo(msg, c.anaToken, step.emoji)
		if resp.Status != http.StatusOK {
			t.Fatalf("react %s: status %d, body %v", step.emoji, resp.Status, resp.Body)
		}
		if step.want == "" && resp.Body["emoji"] != nil || step.want != "" && resp.Body["emoji"] != step.want {
			t.Fatalf("react %s: body %v, want %q", step.emoji, resp.Body, step.want)
		}
		if emoji, _, _ := c.sectorReaction("MSG-1"); emoji != step.want {
			t.Fatalf("after %s the sector shows %q, want %q", step.emoji, emoji, step.want)
		}
	}
	var sent []string
	for _, r := range e.sentReactions() {
		sent = append(sent, r.Emoji)
	}
	// A remoção vai ao WhatsApp como reação vazia.
	if want := []string{"👍", "😂", "", "🙏"}; !reflect.DeepEqual(sent, want) {
		t.Fatalf("sent to WhatsApp = %q, want %q", sent, want)
	}
	if n := e.reactionRows(); n != 1 {
		t.Fatalf("reaction rows = %d", n)
	}
}

func TestReactionOfThePhoneOrOfAnotherAgentIsReplaced(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e
	msg := e.messageID(c.ticket.ID, "MSG-1")

	// Reação feita pelo celular do setor, com o relógio do aparelho adiantado.
	e.reactFromPhone(c.sector.ID, "MSG-1", "😮", time.Now().Add(time.Hour))
	if emoji, by, viaPhone := c.sectorReaction("MSG-1"); emoji != "😮" || by != "" || !viaPhone {
		t.Fatalf("phone reaction = %q by %q (via phone %v)", emoji, by, viaPhone)
	}
	if resp := e.reactTo(msg, c.anaToken, "👍"); resp.Status != http.StatusOK || resp.Body["emoji"] != "👍" {
		t.Fatalf("react over the phone: status %d, body %v", resp.Status, resp.Body)
	}
	if emoji, by, viaPhone := c.sectorReaction("MSG-1"); emoji != "👍" || by != "ana@exemplo.com" || viaPhone {
		t.Fatalf("after the agent = %q by %q (via phone %v)", emoji, by, viaPhone)
	}

	// Outra atendente recebe o chamado e troca a reação de Ana.
	bia := e.userID("bia@exemplo.com")
	if resp := e.transfer(c.ticket.ID, bia, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.reactTo(msg, c.anaToken, "😢"); resp.Status != http.StatusForbidden {
		t.Fatalf("former assignee: status %d", resp.Status)
	}
	if resp := e.reactTo(msg, c.biaToken, "😢"); resp.Status != http.StatusOK || resp.Body["emoji"] != "😢" {
		t.Fatalf("new assignee: status %d, body %v", resp.Status, resp.Body)
	}
	if emoji, by, _ := c.sectorReaction("MSG-1"); emoji != "😢" || by != "bia@exemplo.com" {
		t.Fatalf("after another agent = %q by %q", emoji, by)
	}
	// O mesmo emoji de outra pessoa também é a reação do setor: tocar nele remove.
	e.reactFromPhone(c.sector.ID, "MSG-1", "🙏", time.Now().Add(2*time.Hour))
	if resp := e.reactTo(msg, c.biaToken, "🙏"); resp.Status != http.StatusOK || resp.Body["emoji"] != nil {
		t.Fatalf("remove the phone reaction: status %d, body %v", resp.Status, resp.Body)
	}
	if emoji, _, _ := c.sectorReaction("MSG-1"); emoji != "" {
		t.Fatalf("phone reaction kept: %q", emoji)
	}
	if last := e.sentReactions(); len(last) != 3 || last[2].Emoji != "" {
		t.Fatalf("sent to WhatsApp = %+v", last)
	}
}

func TestOnlyTheAssigneeReactsToAnOpenTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	msg := e.messageID(c.ticket.ID, "MSG-1")

	// Na fila, sem responsável, ninguém reage.
	if resp := e.reactTo(msg, c.anaToken, "👍"); resp.Status != http.StatusForbidden {
		t.Fatalf("queued ticket: status %d", resp.Status)
	}
	c.assign()
	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		if resp := e.reactTo(msg, token, "👍"); resp.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.Status)
		}
	}
	if resp := e.reactTo(msg, "", "👍"); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}

	// Chamado encerrado: nem o responsável reage.
	org, err := e.Q.CreateOrganization(t.Context(), db.CreateOrganizationParams{Name: "Prefeitura", MunicipalityID: e.Municipality("Itu")})
	if err != nil {
		t.Fatal(err)
	}
	e.closeTicket(c.ticket.ID, c.ana.ID, org.ID)
	if resp := e.reactTo(msg, c.anaToken, "👍"); resp.Status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", resp.Status)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("refused reactions reached WhatsApp: %+v", sent)
	}
	if n := e.reactionRows(); n != 0 {
		t.Fatalf("refused reactions recorded: %d", n)
	}
}

func TestReactionNeedsAMessageKnownToWhatsAppAndASingleEmoji(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e

	// Falhou no envio: sem identificador no WhatsApp.
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	resp := e.sendText(c.ticket.ID, c.anaToken, requestB, "Segue o boleto")
	if resp.Body["status"] != "failed" {
		t.Fatalf("send while disconnected: %v", resp.Body)
	}
	failed := int64(resp.Body["id"].(float64))
	e.connectSector(c.sector.ID)
	// Enviada e depois recusada pelo WhatsApp: tem identificador, mas falhou.
	if err := e.WhatsApp.UpdateStatus(t.Context(), c.sector.ID, messaging.DeliveryFailed, c.sentID); err != nil {
		t.Fatal(err)
	}
	failedAfterSent := e.messageID(c.ticket.ID, c.sentID)
	// Enviando: gravada, ainda sem resposta do WhatsApp.
	var pending int64
	err := e.Pool.QueryRow(t.Context(), `
		insert into messages (ticket_id, sector_id, contact_id, direction, origin, author_id, type, body, client_request_id, status, sent_at)
		select ticket_id, sector_id, contact_id, 'outbound', 'agent', $2, 'text', 'Enviando', gen_random_uuid(), 'pending', now()
		from messages where id = $1 returning id`, failed, c.ana.ID).Scan(&pending)
	if err != nil {
		t.Fatal(err)
	}
	for name, id := range map[string]int64{"failed": failed, "failed after sent": failedAfterSent, "pending": pending} {
		if resp := e.reactTo(id, c.anaToken, "👍"); resp.Status != http.StatusConflict || resp.Body["error"] != "Não é possível reagir a esta mensagem." {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	// Notas internas e avisos do sistema não são mensagens: não há o que reagir.
	if resp := e.reactTo(pending+1000, c.anaToken, "👍"); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown message: status %d", resp.Status)
	}

	msg := e.messageID(c.ticket.ID, "MSG-1")
	for _, emoji := range []string{"", " ", "ok", "👍👍", "👍 ", "a👍", "👍a", "🏽", "🇧", "1", "\u200d👍", "👍\u200d", "<b>👍</b>", "👍\n",
		// Símbolos que não são emoji, emojis colados por junção e marcas repetidas.
		"■", "⌘", "🀀", "🦰", "👍\u200d👍\u200d👍", "👍\u200d👍", "❤\ufe0f\ufe0f", "👍🏽🏽", "🏴\U000e0067", "🏴\U000e007f",
		"👨\u200d👩\u200d👧\u200d👦\u200d👦",
		// Sequência inteira: peças válidas que o catálogo não tem, símbolo sem o seletor de variação
		// (☺ para ☺️), par de indicadores sem bandeira, junção solta, dois emojis e uma peça a mais ou a menos.
		"👍\u200d👨", "☺", "🇽🇽", "\u200d", "\u200d👩\u200d💻", "👩\u200d💻\u200d", "👍❤️", "🇧🇷🇧🇷", "1️⃣1️⃣",
		"👩\u200d💻\u200d💻", "👩\u200d", "👨\u200d👩\u200d👧\u200d👦\u200d👧", "👨\u200d👩\u200d👧\u200d", "🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074",
		"🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e0074\U000e007f", "1\ufe0f", "#", "*⃣"} {
		if resp := e.reactTo(msg, c.anaToken, emoji); resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Escolha um emoji para reagir." {
			t.Fatalf("emoji %q: status %d, body %v", emoji, resp.Status, resp.Body)
		}
	}
	if sent := e.sentReactions(); len(sent) != 0 {
		t.Fatalf("refused reactions reached WhatsApp: %+v", sent)
	}
	if n := e.reactionRows(); n != 0 {
		t.Fatalf("refused reactions recorded: %d", n)
	}

	// Emojis com variação, tom de pele, junções, bandeiras e teclas valem.
	for _, emoji := range []string{"❤️", "👍🏾", "👨\u200d👩\u200d👧", "🇧🇷", "1️⃣", "🏴\U000e0067\U000e0062\U000e0073\U000e0063\U000e0074\U000e007f", "☺️",
		"#️⃣", "*️⃣", "👩\u200d💻", "🏳️\u200d🌈", "❤️\u200d🔥", "🕵🏽\u200d♂️", "👨\u200d👩\u200d👧\u200d👦", "↔️"} {
		if resp := e.reactTo(msg, c.anaToken, emoji); resp.Status != http.StatusOK || resp.Body["emoji"] != emoji {
			t.Fatalf("emoji %q: status %d, body %v", emoji, resp.Status, resp.Body)
		}
	}
}

func TestRefusedReactionKeepsTheOneBefore(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e
	msg := e.messageID(c.ticket.ID, "MSG-1")
	if resp := e.reactTo(msg, c.anaToken, "👍"); resp.Status != http.StatusOK {
		t.Fatalf("react: status %d", resp.Status)
	}
	events := e.subscribe(c.anaToken)

	// O WhatsApp recusa a troca: a reação anterior fica, com aviso para a tela.
	e.WhatsApp.FailNextReaction(c.sector.ID)
	resp := e.reactTo(msg, c.anaToken, "😂")
	if resp.Status != http.StatusBadGateway || resp.Body["error"] != "O WhatsApp não aceitou a reação. Tente novamente." {
		t.Fatalf("refused reaction: status %d, body %v", resp.Status, resp.Body)
	}
	if emoji, by, _ := c.sectorReaction("MSG-1"); emoji != "👍" || by != "ana@exemplo.com" {
		t.Fatalf("after the refusal the sector shows %q by %q", emoji, by)
	}
	// A remoção recusada também mantém a reação.
	e.WhatsApp.FailNextReaction(c.sector.ID)
	if resp := e.reactTo(msg, c.anaToken, "👍"); resp.Status != http.StatusBadGateway {
		t.Fatalf("refused removal: status %d", resp.Status)
	}
	if emoji, _, _ := c.sectorReaction("MSG-1"); emoji != "👍" {
		t.Fatalf("after the refused removal the sector shows %q", emoji)
	}
	// A recusa não avisa o painel: nada mudou.
	reactionCase{testEnv: e}.noMoreEvents(events)

	// Número desconectado: nada sai e nada muda.
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.reactTo(msg, c.anaToken, "🙏"); resp.Status != http.StatusBadGateway ||
		resp.Body["error"] != "Número do setor desconectado. A reação não foi enviada." {
		t.Fatalf("disconnected: status %d, body %v", resp.Status, resp.Body)
	}
	if emoji, _, _ := c.sectorReaction("MSG-1"); emoji != "👍" {
		t.Fatalf("after the disconnected try the sector shows %q", emoji)
	}
	// Sem nova tentativa automática: só a primeira reação chegou ao WhatsApp.
	if sent := e.sentReactions(); len(sent) != 1 || sent[0].Emoji != "👍" {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
}

func TestSectorReactionNotifiesThePanelAndKeepsTheLists(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e
	e.queuedTicket(c.sector.ID, "IN-2", "5511977776666")
	list := fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID)
	before := e.DoList(http.MethodGet, list, c.anaToken)
	if len(before) != 2 {
		t.Fatalf("tickets = %v", before)
	}

	events := e.subscribe(c.supToken)
	msg := e.messageID(c.ticket.ID, "MSG-1")
	for _, emoji := range []string{"👍", "👍"} { // reage e remove
		if resp := e.reactTo(msg, c.anaToken, emoji); resp.Status != http.StatusOK {
			t.Fatalf("react %s: status %d", emoji, resp.Status)
		}
		if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
			t.Fatalf("event = %+v", ev)
		}
	}
	// A última mensagem e a ordem das listas continuam as mesmas.
	if after := e.DoList(http.MethodGet, list, c.anaToken); !reflect.DeepEqual(before, after) {
		t.Fatalf("lists changed with the reaction:\nbefore %v\nafter  %v", before, after)
	}
}

func TestConcurrentReactionRequestsDoNotDuplicate(t *testing.T) {
	t.Parallel()
	c := newReactionConversation(t)
	e := c.e
	msg := e.messageID(c.ticket.ID, "MSG-1")

	// Dois pedidos iguais ao mesmo tempo (duplo clique): nenhum quebra, e fica uma reação só.
	var wg sync.WaitGroup
	statuses := make([]int, 2)
	for i := range statuses {
		wg.Go(func() { statuses[i] = e.reactTo(msg, c.anaToken, "👍").Status })
	}
	wg.Wait()
	for i, s := range statuses {
		if s != http.StatusOK {
			t.Fatalf("request %d: status %d", i, s)
		}
	}
	if n := e.reactionRows(); n != 1 {
		t.Fatalf("reaction rows = %d", n)
	}
	// O mesmo emoji remove (spec #196): conforme a ordem, os dois pedidos põem
	// 👍, ou o segundo remove. Cada um vai ao WhatsApp uma vez, e o painel
	// mostra o que foi enviado por último.
	sent := e.sentReactions()
	if len(sent) != 2 || sent[0].Emoji != "👍" || (sent[1].Emoji != "👍" && sent[1].Emoji != "") {
		t.Fatalf("sent reactions = %+v", sent)
	}
	emoji, _, _ := c.sectorReaction("MSG-1")
	if emoji != sent[1].Emoji {
		t.Fatalf("sector reaction = %q, last sent %q", emoji, sent[1].Emoji)
	}
}
