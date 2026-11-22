package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

func (e *testEnv) markRead(ticketID int64, token string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/read", ticketID), token, nil)
}

// unreadOf returns the unread count of the ticket in the list of the sector,
// where "Meus chamados" and the queue come from.
func (e *testEnv) unreadOf(sectorID, ticketID int64, token string) int {
	e.T.Helper()
	for _, item := range e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", sectorID), token) {
		if int64(item["id"].(float64)) == ticketID {
			count, ok := item["unreadCount"].(float64)
			if !ok {
				e.T.Fatalf("ticket %d without unreadCount: %v", ticketID, item)
			}
			return int(count)
		}
	}
	e.T.Fatalf("ticket %d not in the list", ticketID)
	return 0
}

// readAt returns assignee_read_at of the ticket.
func (e *testEnv) readAt(ticketID int64) *time.Time {
	e.T.Helper()
	var at *time.Time
	if err := e.Pool.QueryRow(e.T.Context(), "select assignee_read_at from tickets where id = $1", ticketID).Scan(&at); err != nil {
		e.T.Fatal(err)
	}
	return at
}

func (e *testEnv) backdateCreatedAt(messageID int64, ago time.Duration) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(),
		"update messages set created_at = now() - make_interval(secs => $2) where id = $1", messageID, ago.Seconds()); err != nil {
		e.T.Fatal(err)
	}
}

const unreadContact = "5511988887777@s.whatsapp.net"

// Cada mensagem recebida do cliente conta uma vez, de qualquer tipo; o que sai
// pelo XET ou pelo celular do setor, e as reações, edições e exclusões, não contam.
func TestUnreadCountsOnlyReceivedCustomerMessages(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	// Na fila não há não lidas: o responsável ainda não existe.
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("queued ticket unread = %d", got)
	}
	c.assign()
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("assigned ticket unread = %d", got)
	}

	e.receive(c.sector.ID, text("IN-TEXT", unreadContact, "5511988887777", "Oi, preciso de ajuda"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
		t.Fatalf("unread after the text = %d", got)
	}

	doc := text("IN-DOC", unreadContact, "5511988887777", "nota.pdf")
	doc.Type = messaging.TypeDocument
	doc.Media = &messaging.Media{Data: []byte("%PDF-1.7"), MimeType: "application/pdf", FileName: "nota.pdf"}
	e.receive(c.sector.ID, doc)
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 2 {
		t.Fatalf("unread after the file = %d", got)
	}

	sticker := text("IN-STK", unreadContact, "5511988887777", "")
	sticker.Type = messaging.TypeUnsupported
	e.receive(c.sector.ID, sticker)
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 3 {
		t.Fatalf("unread after the unsupported = %d", got)
	}

	unavailable := text("IN-UNAV", unreadContact, "5511988887777", "video-grande.mp4")
	unavailable.Type = messaging.TypeMediaUnavailable
	e.receive(c.sector.ID, unavailable)
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 4 {
		t.Fatalf("unread after the unavailable media = %d", got)
	}

	// Mensagem enviada pelo XET não conta.
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Já estou verificando."); resp.Status != http.StatusOK {
		t.Fatalf("send: status %d, body %v", resp.Status, resp.Body)
	}
	// Nem a enviada pelo celular do setor, fora do sistema.
	e.sendOutside(c.sector.ID, text("OUT-1", unreadContact, "5511988887777", "Enviada pelo celular"))
	// Nem a reação, a edição e a exclusão do cliente.
	e.react(c.sector.ID, "IN-TEXT", "👍", time.Now())
	e.edit(c.sector.ID, "EDIT-1", "IN-TEXT", "Oi, preciso de ajuda hoje", time.Now())
	e.revoke(c.sector.ID, "REV-1", "IN-TEXT", false, time.Now())
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 4 {
		t.Fatalf("unread after what is not a received message = %d", got)
	}

	// A leitura do responsável zera.
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("mark read: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread after the reading = %d", got)
	}
}

// Marcar como lido só muda para o responsável atual do chamado em atendimento;
// para os demais responde sucesso sem mudar nada.
func TestMarkReadOnlyForTheCurrentAssignee(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	e.receive(c.sector.ID, text("IN-1", unreadContact, "5511988887777", "Alguém aí?"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
		t.Fatalf("unread = %d", got)
	}
	before := e.readAt(c.ticket.ID)

	// Outro atendente do setor, a supervisão e o administrador: sucesso sem mudar nada.
	for name, token := range map[string]string{
		"another agent": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken,
	} {
		if resp := e.markRead(c.ticket.ID, token); resp.Status != http.StatusNoContent {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
		if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
			t.Fatalf("%s: unread after the reading = %d", name, got)
		}
		if got := e.readAt(c.ticket.ID); got == nil || !got.Equal(*before) {
			t.Fatalf("%s: reading moved from %v to %v", name, before, got)
		}
	}

	// O responsável zera; repetir é sucesso e não muda de novo.
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("assignee: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread after the assignee read = %d", got)
	}
	read := e.readAt(c.ticket.ID)
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("repeated: status %d", resp.Status)
	}
	if got := e.readAt(c.ticket.ID); got == nil || got.Before(*read) {
		t.Fatalf("repeated reading went back from %v to %v", read, got)
	}
	read = e.readAt(c.ticket.ID)

	// Chamado encerrado: sucesso sem mudar nada.
	e.closeTicket(c.ticket.ID, c.ana.ID, e.Organization(c.supToken, "Prefeitura", ""))
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("closed ticket: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.readAt(c.ticket.ID); got == nil || !got.Equal(*read) {
		t.Fatalf("closed ticket moved the reading from %v to %v", read, got)
	}

	// Quem não vê o chamado não o marca como lido, e um chamado inexistente não é encontrado.
	if resp := e.markRead(c.ticket.ID, c.rhToken); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of another sector: status %d", resp.Status)
	}
	if resp := e.markRead(999999, c.anaToken); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown ticket: status %d", resp.Status)
	}
	if resp := e.markRead(c.ticket.ID, ""); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
}

// A leitura recomeça quando o chamado é assumido, recebido por transferência ou
// criado pelo atendente, e é limpa ao devolver à fila.
func TestReadingRestartsWhenTheTicketIsTaken(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	// O chamado já tem a mensagem do cliente que o abriu, mas a fila não tem não lidas.
	c.assign()
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread after assigning = %d", got)
	}
	e.receive(c.sector.ID, text("IN-1", unreadContact, "5511988887777", "Continua aí?"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
		t.Fatalf("unread before the transfer = %d", got)
	}

	// A transferência entre atendentes recomeça a contagem para quem recebe.
	bia := e.userID("bia@exemplo.com")
	if resp := e.transfer(c.ticket.ID, bia, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread after the transfer = %d", got)
	}
	e.receive(c.sector.ID, text("IN-2", unreadContact, "5511988887777", "Voltei"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
		t.Fatalf("unread under the new assignee = %d", got)
	}

	// Devolver à fila limpa a leitura, e quem assume de novo começa sem não lidas.
	biaToken := e.Login("bia@exemplo.com", testPassword)
	if resp := e.returnToQueue(c.ticket.ID, biaToken); resp.Status != http.StatusOK {
		t.Fatalf("return: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.readAt(c.ticket.ID); got != nil {
		t.Fatalf("reading in the queue = %v", got)
	}
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread in the queue = %d", got)
	}
	c.assign()
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread after assigning again = %d", got)
	}

	// Chamado iniciado pelo atendente nasce sem não lidas, mesmo com mensagem
	// recebida antes do início gravada no chamado.
	org := e.Organization(c.supToken, "Prefeitura de Santos", "")
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", org, c.sector.ID)
	resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestC, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	started := int64(resp.Body["ticketId"].(float64))
	if got := e.unreadOf(c.sector.ID, started, c.biaToken); got != 0 {
		t.Fatalf("unread of the started ticket = %d", got)
	}
	e.receive(c.sector.ID, text("IN-CARLA", "5513988881111@s.whatsapp.net", "5513988881111", "Obrigada!"))
	message := e.messages(started)[1]
	e.backdateCreatedAt(message.ID, time.Hour)
	if got := e.unreadOf(c.sector.ID, started, c.biaToken); got != 0 {
		t.Fatalf("unread of a message recorded before the start = %d", got)
	}
	e.receive(c.sector.ID, text("IN-CARLA-2", "5513988881111@s.whatsapp.net", "5513988881111", "Só mais uma coisa"))
	if got := e.unreadOf(c.sector.ID, started, c.biaToken); got != 1 {
		t.Fatalf("unread after the reply = %d", got)
	}
}

// A quantidade usa o horário de gravação no servidor e a leitura só avança.
func TestUnreadUsesTheServerTimeAndOnlyMovesForward(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	e.receive(c.sector.ID, text("IN-1", unreadContact, "5511988887777", "Oi"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 1 {
		t.Fatalf("unread = %d", got)
	}

	// O relógio do celular não interfere: a mensagem foi gravada antes da
	// leitura, mesmo que o horário do WhatsApp seja agora.
	capturedAt := time.Now()
	e.backdateCreatedAt(e.messages(c.ticket.ID)[1].ID, time.Hour)
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread of a message recorded before the reading = %d", got)
	}

	// Uma leitura posterior no relógio do servidor não volta o valor gravado.
	future := time.Now().Add(time.Hour).Truncate(time.Microsecond)
	if _, err := e.Pool.Exec(t.Context(), "update tickets set assignee_read_at = $2 where id = $1", c.ticket.ID, future); err != nil {
		t.Fatal(err)
	}
	e.receive(c.sector.ID, text("IN-2", unreadContact, "5511988887777", "Depois"))
	if got := e.unreadOf(c.sector.ID, c.ticket.ID, c.biaToken); got != 0 {
		t.Fatalf("unread with a future reading = %d", got)
	}
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("mark read: status %d", resp.Status)
	}
	if got := e.readAt(c.ticket.ID); got == nil || !got.Equal(future) {
		t.Fatalf("reading moved back from %v to %v (%v)", future, got, capturedAt)
	}
}

// Marcar como lido avisa o setor, para as outras abas do mesmo usuário recarregarem.
func TestMarkReadPublishesTheTicketEvent(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	e.receive(c.sector.ID, text("IN-1", unreadContact, "5511988887777", "Oi"))

	events := e.subscribe(c.supToken)
	if resp := e.markRead(c.ticket.ID, c.anaToken); resp.Status != http.StatusNoContent {
		t.Fatalf("mark read: status %d", resp.Status)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
}
