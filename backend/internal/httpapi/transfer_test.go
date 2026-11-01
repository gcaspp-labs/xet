package httpapi

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

func (e *testEnv) transfer(ticketID, assigneeID int64, token string) response {
	e.t.Helper()
	return e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/transfer", ticketID), token,
		map[string]any{"assigneeId": assigneeID})
}

func (e *testEnv) userID(email string) int64 {
	e.t.Helper()
	u, err := e.q.GetUserByEmail(e.t.Context(), email)
	if err != nil {
		e.t.Fatal(err)
	}
	return u.ID
}

// ticketActions returns the audit actions of the ticket, oldest first.
func (c conversation) ticketActions() ([]string, []map[string]map[string]any) {
	c.e.t.Helper()
	return c.e.auditChanges("ticket", c.ticket.ID)
}

func TestTransferMovesTheReplyToTheNewAssignee(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	bia := e.userID("bia@exemplo.com")
	before := e.assignment(c.ticket.ID)
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Vou verificar."); resp.status != http.StatusOK {
		t.Fatalf("send before transfer: status %d", resp.status)
	}

	supEvents := e.subscribe(c.supToken)
	rhEvents := e.subscribe(c.rhToken)
	resp := e.transfer(c.ticket.ID, bia, c.anaToken)
	if resp.status != http.StatusOK || resp.body["assigneeId"] != float64(bia) || resp.body["status"] != "in_progress" {
		t.Fatalf("transfer: status %d, body %v", resp.status, resp.body)
	}
	// O setor é avisado depois do commit; outro setor não recebe nada.
	if ev := e.nextEvent(supEvents); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	// O novo responsável responde; o anterior não, mesmo chamando a API.
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestB, "Ainda estou aqui"); resp.status != http.StatusForbidden {
		t.Fatalf("previous assignee sending: status %d", resp.status)
	}
	if resp := e.sendText(c.ticket.ID, e.login("bia@exemplo.com", testPassword), requestC, "Assumi o seu atendimento."); resp.status != http.StatusOK {
		t.Fatalf("new assignee sending: status %d, body %v", resp.status, resp.body)
	}

	// A transferência preserva mensagens e o momento em que o chamado foi assumido.
	after := e.assignment(c.ticket.ID)
	if after.Status != "in_progress" || *after.AssigneeID != bia || !after.AssignedAt.Equal(*before.AssignedAt) {
		t.Fatalf("assignment after transfer = %+v (before %+v)", after, before)
	}
	if msgs := e.messages(c.ticket.ID); len(msgs) != 3 || msgs[0].Origin != "customer" ||
		*msgs[1].AuthorID != c.ana.ID || *msgs[2].AuthorID != bia {
		t.Fatalf("messages = %+v", msgs)
	}

	// Auditoria com autor e responsável anterior e novo.
	actions, changes := c.ticketActions()
	if len(actions) != 2 || actions[0] != "ticket_assigned" || actions[1] != "ticket_transferred_user" {
		t.Fatalf("audit actions = %v", actions)
	}
	if len(changes[1]) != 1 || changes[1]["assignee_id"]["from"] != float64(c.ana.ID) || changes[1]["assignee_id"]["to"] != float64(bia) {
		t.Fatalf("transfer changes = %v", changes[1])
	}
	var actor int64
	if err := e.pool.QueryRow(t.Context(),
		"select actor_id from audit_logs where ticket_id = $1 and action = 'ticket_transferred_user'", c.ticket.ID).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if actor != c.ana.ID {
		t.Fatalf("transfer actor = %d", actor)
	}

	// A conversa mostra quando foi assumido e a transferência, com os nomes.
	logs := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.supToken)
	if len(logs) != 2 {
		t.Fatalf("assignments = %v", logs)
	}
	if logs[0]["action"] != "ticket_assigned" || logs[0]["toName"] != "ana@exemplo.com" || logs[0]["fromName"] != nil {
		t.Fatalf("assigned log = %v", logs[0])
	}
	if logs[1]["action"] != "ticket_transferred_user" || logs[1]["fromName"] != "ana@exemplo.com" ||
		logs[1]["toName"] != "bia@exemplo.com" || logs[1]["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("transfer log = %v", logs[1])
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("assignments from another sector: status %d", status)
	}

	// O atendente do RH recebe primeiro o evento do próprio setor: nada do
	// chamado transferido chegou antes.
	rh, err := e.q.GetUserByEmail(t.Context(), "rh@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	rhTicket := e.queuedTicket(*rh.SectorID, "RH-1", "5511977776666")
	if ev := e.nextEvent(rhEvents); ev != realtime.TicketChanged(*rh.SectorID, rhTicket.ID) {
		t.Fatalf("rh agent event = %+v, want only events of RH", ev)
	}
}

func TestTransferPermissions(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	bia := e.userID("bia@exemplo.com")
	sup := e.userID("sup@exemplo.com")
	admin := e.userID("admin@exemplo.com")
	rh := e.userID("rh@exemplo.com")

	// Chamado na fila é assumido, não transferido.
	if resp := e.transfer(c.ticket.ID, bia, c.supToken); resp.status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.status)
	}
	c.assign()

	// Atendente que não é o responsável não transfere; outro setor não acessa.
	if resp := e.transfer(c.ticket.ID, bia, c.biaToken); resp.status != http.StatusForbidden {
		t.Fatalf("agent taking a colleague's ticket: status %d", resp.status)
	}
	if resp := e.transfer(c.ticket.ID, rh, c.rhToken); resp.status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.status)
	}
	if resp := e.transfer(c.ticket.ID, bia, ""); resp.status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.status)
	}

	// O destino é um usuário ativo do setor do chamado.
	inactive := e.user("inativa@exemplo.com", db.UserRoleAgent, &c.sector.ID)
	if _, err := e.pool.Exec(t.Context(), "update users set active = false where id = $1", inactive.ID); err != nil {
		t.Fatal(err)
	}
	for name, target := range map[string]int64{
		"admin": admin, "other sector": rh, "inactive": inactive.ID, "unknown": 999999,
	} {
		if resp := e.transfer(c.ticket.ID, target, c.anaToken); resp.status != http.StatusUnprocessableEntity {
			t.Fatalf("target %s: status %d", name, resp.status)
		}
	}
	if resp := e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/transfer", c.ticket.ID), c.anaToken, map[string]any{}); resp.status != http.StatusUnprocessableEntity {
		t.Fatalf("without target: status %d", resp.status)
	}
	if got := e.assignment(c.ticket.ID); *got.AssigneeID != c.ana.ID {
		t.Fatalf("refused transfers changed the assignee: %+v", got)
	}

	// Supervisor e administrador transferem chamados de outros atendentes.
	if resp := e.transfer(c.ticket.ID, sup, c.supToken); resp.status != http.StatusOK {
		t.Fatalf("supervisor taking the ticket: status %d", resp.status)
	}
	if resp := e.transfer(c.ticket.ID, bia, c.adminToken); resp.status != http.StatusOK {
		t.Fatalf("admin transferring: status %d", resp.status)
	}
	// Repetir para quem já é o responsável não grava de novo.
	if resp := e.transfer(c.ticket.ID, bia, c.adminToken); resp.status != http.StatusOK || resp.body["assigneeId"] != float64(bia) {
		t.Fatalf("repeated transfer: status %d, body %v", resp.status, resp.body)
	}
	actions, _ := c.ticketActions()
	if len(actions) != 3 || actions[1] != "ticket_transferred_user" || actions[2] != "ticket_transferred_user" {
		t.Fatalf("audit actions = %v", actions)
	}

	// Chamado encerrado não é transferido.
	e.closeTicket(c.ticket.ID, bia, e.organization(c.supToken, "Prefeitura", ""))
	if resp := e.transfer(c.ticket.ID, sup, c.supToken); resp.status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", resp.status)
	}
}

func TestOnlyOneConcurrentTransferWins(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	// O responsável dispara várias transferências ao mesmo tempo para destinos
	// diferentes: a primeira tira dele o chamado, e as demais são recusadas.
	const targets = 8
	ids := make([]int64, targets)
	for i := range ids {
		ids[i] = e.user(fmt.Sprintf("destino%d@exemplo.com", i), db.UserRoleAgent, &c.sector.ID).ID
	}
	statuses := make([]int, targets)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range ids {
		wg.Go(func() {
			<-start
			statuses[i] = e.transfer(c.ticket.ID, ids[i], c.anaToken).status
		})
	}
	close(start)
	wg.Wait()

	winner := int64(0)
	for i, status := range statuses {
		switch status {
		case http.StatusOK:
			if winner != 0 {
				t.Fatalf("two transfers won: %v", statuses)
			}
			winner = ids[i]
		case http.StatusForbidden:
		default:
			t.Fatalf("unexpected status %d: %v", status, statuses)
		}
	}
	if got := e.assignment(c.ticket.ID); winner == 0 || *got.AssigneeID != winner {
		t.Fatalf("assignee %v, winner %d", got.AssigneeID, winner)
	}
	actions, _ := c.ticketActions()
	if len(actions) != 2 {
		t.Fatalf("audit actions = %v", actions)
	}
}
