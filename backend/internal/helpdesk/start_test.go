package helpdesk_test

import (
	"fmt"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging"
)

const requestC = "8b3d8f50-3f2c-4b7d-9e30-2c3d4e5f6071"

func (e *testEnv) startConversation(sectorID, contactID int64, token, requestID, body string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/conversations", sectorID), token,
		map[string]any{"contactId": contactID, "clientRequestId": requestID, "body": body})
}

func (e *testEnv) openTicketOf(sectorID, contactID int64, token string) response {
	e.T.Helper()
	return e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/contacts/%d/open-ticket", sectorID, contactID), token, nil)
}

type startedTicket struct {
	Status         string
	AssigneeID     *int64
	CreatedByID    *int64
	OrganizationID *int64
	ArrivedAt      time.Time
	AssignedAt     *time.Time
	StartedAt      time.Time
}

func (e *testEnv) startedTicket(ticketID int64) startedTicket {
	e.T.Helper()
	var t startedTicket
	err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, assignee_id, created_by_id, organization_id, arrived_at, assigned_at, started_at
		from tickets where id = $1`, ticketID).
		Scan(&t.Status, &t.AssigneeID, &t.CreatedByID, &t.OrganizationID, &t.ArrivedAt, &t.AssignedAt, &t.StartedAt)
	if err != nil {
		e.T.Fatal(err)
	}
	return t
}

func TestStartConversationCreatesTicketAssignedToTheAgent(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	org := e.Organization(c.supToken, "Prefeitura de Santos", "")
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", org, c.sector.ID)

	resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia, Carla. Sua guia está pronta.")
	if resp.Status != http.StatusCreated || resp.Body["existing"] != false {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	ticketID := int64(resp.Body["ticketId"].(float64))
	if msg := resp.Body["message"].(map[string]any); msg["status"] != "sent" {
		t.Fatalf("first message = %v", msg)
	}

	// O chamado nasce em atendimento com o atendente que iniciou e o órgão do contato.
	got := e.startedTicket(ticketID)
	if got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != c.ana.ID ||
		got.CreatedByID == nil || *got.CreatedByID != c.ana.ID || got.OrganizationID == nil || *got.OrganizationID != org {
		t.Fatalf("ticket = %+v", got)
	}
	// O início é o envio da primeira mensagem.
	msgs := e.messages(ticketID)
	if len(msgs) != 1 || msgs[0].Origin != "agent" || *msgs[0].AuthorID != c.ana.ID ||
		str(msgs[0].Body) != "ana@exemplo.com: Bom dia, Carla. Sua guia está pronta." || str(msgs[0].Status) != "sent" {
		t.Fatalf("messages = %+v", msgs)
	}
	if !got.ArrivedAt.Equal(msgs[0].SentAt) || !got.StartedAt.Equal(got.ArrivedAt) || got.AssignedAt == nil || !got.AssignedAt.Equal(got.ArrivedAt) {
		t.Fatalf("times: ticket %+v, message sent at %v", got, msgs[0].SentAt)
	}
	sent := e.WhatsApp.SentMessages()
	if len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	if msg, ok := sent[0].(messaging.TextMessage); !ok || msg.SectorID != c.sector.ID || msg.To != "5513988881111@fake" ||
		msg.Body != "ana@exemplo.com: Bom dia, Carla. Sua guia está pronta." || msg.IdempotencyKey != requestA {
		t.Fatalf("WhatsApp message = %+v", sent[0])
	}

	// O painel mostra o chamado em atendimento, e quem iniciou responde.
	list := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.biaToken)
	found := false
	for _, item := range list {
		if int64(item["id"].(float64)) == ticketID {
			found = item["status"] == "in_progress" && item["assignee"].(map[string]any)["name"] == "ana@exemplo.com"
		}
	}
	if !found {
		t.Fatalf("panel = %v", list)
	}
	if resp := e.sendText(ticketID, c.anaToken, requestB, "Qualquer dúvida, estou à disposição."); resp.Status != http.StatusOK {
		t.Fatalf("reply: status %d", resp.Status)
	}
	if resp := e.sendText(ticketID, c.biaToken, requestC, "Oi"); resp.Status != http.StatusForbidden {
		t.Fatalf("another agent: status %d", resp.Status)
	}

	// A resposta do cliente entra no mesmo chamado.
	e.receive(c.sector.ID, text("MSG-CARLA", "5513988881111@s.whatsapp.net", "5513988881111", "Obrigada!"))
	if msgs := e.messages(ticketID); len(msgs) != 3 || msgs[2].Origin != "customer" {
		t.Fatalf("messages after reply = %+v", msgs)
	}
}

func TestStartConversationIsIdempotent(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", e.Organization(c.supToken, "Prefeitura", ""), c.sector.ID)

	// Cliques repetidos e simultâneos com o mesmo identificador geram um único chamado e uma única mensagem.
	const attempts = 8
	responses := make([]response, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			responses[i] = e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia")
		})
	}
	wg.Wait()
	ticketID := responses[0].Body["ticketId"]
	for i, resp := range responses {
		if resp.Status != http.StatusCreated || resp.Body["ticketId"] != ticketID || resp.Body["existing"] != false {
			t.Fatalf("attempt %d: status %d, body %v", i, resp.Status, resp.Body)
		}
	}
	if n := len(e.messages(int64(ticketID.(float64)))); n != 1 {
		t.Fatalf("messages = %d", n)
	}
	var tickets int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from tickets where contact_id = $1", carla).Scan(&tickets); err != nil {
		t.Fatal(err)
	}
	if tickets != 1 {
		t.Fatalf("tickets = %d", tickets)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}

	// O mesmo identificador não serve para outra pessoa nem outro contato.
	if resp := e.startConversation(c.sector.ID, carla, c.biaToken, requestA, "Bom dia"); resp.Status != http.StatusConflict {
		t.Fatalf("other author: status %d", resp.Status)
	}
	other := e.Contact(c.anaToken, "Davi Lima", "5513988882222", e.Organization(c.supToken, "Câmara", ""), c.sector.ID)
	if resp := e.startConversation(c.sector.ID, other, c.anaToken, requestA, "Bom dia"); resp.Status != http.StatusConflict {
		t.Fatalf("other contact: status %d", resp.Status)
	}
}

func TestStartConversationDirectsToTheOpenTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	// newConversation já recebeu uma mensagem: o contato tem chamado na fila.
	queued := c.ticket

	check := e.openTicketOf(c.sector.ID, queued.ContactID, c.biaToken)
	if check.Status != http.StatusOK || check.Body["ticketId"] != float64(queued.ID) {
		t.Fatalf("open ticket: status %d, body %v", check.Status, check.Body)
	}

	// Iniciar conversa com o contato direciona para o chamado existente, sem enviar nada.
	resp := e.startConversation(c.sector.ID, queued.ContactID, c.biaToken, requestA, "Bom dia")
	if resp.Status != http.StatusOK || resp.Body["existing"] != true || resp.Body["ticketId"] != float64(queued.ID) ||
		resp.Body["message"] != nil {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.outbound(queued.ID); len(got) != 0 {
		t.Fatalf("outbound messages = %+v", got)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	if a := e.assignment(queued.ID); a.Status != "queued" || a.AssigneeID != nil {
		t.Fatalf("ticket changed: %+v", a)
	}

	// Com responsável, o direcionamento não dá permissão de resposta: segue sendo preciso a transferência.
	c.assign()
	resp = e.startConversation(c.sector.ID, queued.ContactID, c.biaToken, requestB, "Bom dia")
	if resp.Status != http.StatusOK || resp.Body["existing"] != true || resp.Body["ticketId"] != float64(queued.ID) {
		t.Fatalf("start with assignee: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.sendText(queued.ID, c.biaToken, requestC, "Bom dia"); resp.Status != http.StatusForbidden {
		t.Fatalf("directed agent replies: status %d", resp.Status)
	}
	if a := e.assignment(queued.ID); a.AssigneeID == nil || *a.AssigneeID != c.ana.ID {
		t.Fatalf("assignee changed: %+v", a)
	}

	// Encerrado o chamado, iniciar conversa abre um novo.
	e.closeTicket(queued.ID, c.ana.ID, e.Organization(c.supToken, "Prefeitura", ""))
	if check := e.openTicketOf(c.sector.ID, queued.ContactID, c.biaToken); check.Status != http.StatusOK || check.Body["ticketId"] != nil {
		t.Fatalf("open ticket after closing: status %d, body %v", check.Status, check.Body)
	}
	resp = e.startConversation(c.sector.ID, queued.ContactID, c.biaToken, requestC, "Bom dia")
	if resp.Status != http.StatusCreated || resp.Body["ticketId"] == float64(queued.ID) {
		t.Fatalf("start after closing: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestStartConversationConcurrentAgentsShareOneTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", e.Organization(c.supToken, "Prefeitura", ""), c.sector.ID)

	// Dois atendentes iniciam ao mesmo tempo: um cria o chamado e o outro é direcionado a ele.
	tokens := []string{c.anaToken, c.biaToken}
	requests := []string{requestA, requestB}
	responses := make([]response, len(tokens))
	var wg sync.WaitGroup
	for i := range tokens {
		wg.Go(func() {
			responses[i] = e.startConversation(c.sector.ID, carla, tokens[i], requests[i], "Bom dia")
		})
	}
	wg.Wait()
	created, existing := 0, 0
	for _, resp := range responses {
		switch {
		case resp.Status == http.StatusCreated:
			created++
		case resp.Status == http.StatusOK && resp.Body["existing"] == true:
			existing++
		default:
			t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
		}
	}
	if created != 1 || existing != 1 || responses[0].Body["ticketId"] != responses[1].Body["ticketId"] {
		t.Fatalf("responses = %+v", responses)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 1 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
}

func TestStartConversationPermissions(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rh := e.Sector("Tributos")
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", e.Organization(c.supToken, "Prefeitura", ""), c.sector.ID)

	// Só pelo número do próprio setor; o administrador inicia em qualquer setor.
	if resp := e.startConversation(c.sector.ID, carla, c.rhToken, requestA, "Bom dia"); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of another sector: status %d", resp.Status)
	}
	if resp := e.openTicketOf(c.sector.ID, carla, c.rhToken); resp.Status != http.StatusForbidden {
		t.Fatalf("open ticket from another sector: status %d", resp.Status)
	}
	if resp := e.startConversation(rh.ID, carla, c.anaToken, requestA, "Bom dia"); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector number: status %d", resp.Status)
	}
	if resp := e.startConversation(c.sector.ID, carla, "", requestA, "Bom dia"); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	if n := e.Count("messages where origin = 'agent'"); n != 0 {
		t.Fatalf("blocked starts recorded %d messages", n)
	}

	resp := e.startConversation(c.sector.ID, carla, c.adminToken, requestA, "Bom dia")
	if resp.Status != http.StatusCreated {
		t.Fatalf("admin: status %d, body %v", resp.Status, resp.Body)
	}
	if a := e.assignment(int64(resp.Body["ticketId"].(float64))); a.AssigneeID == nil || a.Status != "in_progress" {
		t.Fatalf("admin ticket = %+v", a)
	}
	if resp := e.startConversation(999999, carla, c.adminToken, requestB, "Bom dia"); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown sector: status %d", resp.Status)
	}

	// Entradas inválidas.
	if resp := e.startConversation(c.sector.ID, 999999, c.anaToken, requestB, "Bom dia"); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unknown contact: status %d", resp.Status)
	}
	if resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestB, "   "); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("empty body: status %d", resp.Status)
	}
	var noPhone int64
	if err := e.Pool.QueryRow(t.Context(), "insert into contacts (name, registered) values ('Sem telefone', false) returning id").Scan(&noPhone); err != nil {
		t.Fatal(err)
	}
	if resp := e.startConversation(c.sector.ID, noPhone, c.anaToken, requestB, "Bom dia"); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("contact without phone: status %d", resp.Status)
	}
}

func TestStartConversationWithDisconnectedNumberFails(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", e.Organization(c.supToken, "Prefeitura", ""), c.sector.ID)
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}

	// O chamado é criado e a mensagem fica com falha, para o responsável reenviar.
	resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	msg := resp.Body["message"].(map[string]any)
	if msg["status"] != "failed" || msg["failureReason"] != "Número do setor desconectado." {
		t.Fatalf("message = %v", msg)
	}
	e.connectSector(c.sector.ID)
	retry := e.Do(http.MethodPost, fmt.Sprintf("/api/messages/%d/retry", int64(msg["id"].(float64))), c.anaToken, nil)
	if retry.Status != http.StatusOK || retry.Body["status"] != "sent" {
		t.Fatalf("retry: status %d, body %v", retry.Status, retry.Body)
	}
}

func TestStartConversationRecordsTheAssignment(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	org := e.Organization(c.supToken, "Prefeitura de Santos", "")
	carla := e.Contact(c.anaToken, "Carla Souza", "5513988881111", org, c.sector.ID)

	resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia, Carla.")
	if resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	ticketID := int64(resp.Body["ticketId"].(float64))
	// Repetir o pedido não grava de novo.
	if resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia, Carla."); resp.Body["ticketId"] != float64(ticketID) {
		t.Fatalf("repeated start: status %d, body %v", resp.Status, resp.Body)
	}
	// Quem é direcionado ao chamado aberto não assume nada.
	if resp := e.startConversation(c.sector.ID, carla, c.biaToken, requestB, "Oi"); resp.Body["existing"] != true {
		t.Fatalf("start with open ticket: status %d, body %v", resp.Status, resp.Body)
	}

	// Iniciar conta como assumir: auditoria na mesma transação que cria o chamado.
	actions, changes := e.AuditChanges("ticket", ticketID)
	if len(actions) != 1 || actions[0] != "ticket_started" {
		t.Fatalf("audit actions = %v", actions)
	}
	if changes[0]["status"]["from"] != nil || changes[0]["status"]["to"] != "in_progress" ||
		changes[0]["assignee_id"]["from"] != nil || changes[0]["assignee_id"]["to"] != float64(c.ana.ID) {
		t.Fatalf("started changes = %v", changes[0])
	}

	// A conversa mostra o início antes de uma transferência.
	if resp := e.transfer(ticketID, e.userID("bia@exemplo.com"), c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d", resp.Status)
	}
	logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", ticketID), c.supToken)
	if len(logs) != 2 || logs[0]["action"] != "ticket_started" || logs[0]["toName"] != "ana@exemplo.com" ||
		logs[0]["actor"].(map[string]any)["name"] != "ana@exemplo.com" || logs[1]["action"] != "ticket_transferred_user" {
		t.Fatalf("assignments = %v", logs)
	}
}

func TestStartConversationLinksTheContactToTheSector(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rh := e.Sector("Recursos")
	carla := e.Contact(c.adminToken, "Carla Souza", "5513988881111", e.Organization(c.supToken, "Prefeitura", ""), rh.ID)

	if resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia"); resp.Status != http.StatusCreated {
		t.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	want := []int64{c.sector.ID, rh.ID}
	slices.Sort(want)
	if got := e.contactSectors(carla); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("sectors = %v, want %v", got, want)
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "contact", EntityID: carla})
	if err != nil {
		t.Fatal(err)
	}
	if last := logs[len(logs)-1]; last.Action != "contact_sector_linked" || last.ActorID == nil || *last.ActorID != c.ana.ID {
		t.Fatalf("audit: %+v", last)
	}
	// Repetir a requisição não duplica o vínculo.
	if resp := e.startConversation(c.sector.ID, carla, c.anaToken, requestA, "Bom dia"); resp.Status >= 300 {
		t.Fatalf("repeat: status %d", resp.Status)
	}
	if got := e.contactSectors(carla); len(got) != 2 {
		t.Fatalf("after repeat: %v", got)
	}
}
