package httpapi

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func (e *testEnv) returnToQueue(ticketID int64, token string) response {
	e.t.Helper()
	return e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/return", ticketID), token, nil)
}

func TestReturnToQueueAndSomeoneElseAssigns(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	bia := e.userID("bia@exemplo.com")
	before := e.assignment(c.ticket.ID)
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Vou verificar."); resp.status != http.StatusOK {
		t.Fatalf("send before returning: status %d", resp.status)
	}

	events := e.subscribe(c.supToken)
	resp := e.returnToQueue(c.ticket.ID, c.anaToken)
	if resp.status != http.StatusOK || resp.body["status"] != "queued" || resp.body["assigneeId"] != nil {
		t.Fatalf("return: status %d, body %v", resp.status, resp.body)
	}
	// O setor é avisado depois do commit.
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	// Volta à fila sem responsável, com o horário em que foi assumido.
	after := e.assignment(c.ticket.ID)
	if after.Status != "queued" || after.AssigneeID != nil || !after.AssignedAt.Equal(*before.AssignedAt) {
		t.Fatalf("assignment after return = %+v (before %+v)", after, before)
	}

	// Quem devolveu não responde mais; a mensagem do cliente entra no mesmo chamado.
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestB, "Ainda estou aqui"); resp.status != http.StatusForbidden {
		t.Fatalf("previous assignee sending: status %d", resp.status)
	}
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Alguém pode ajudar?"))
	if tickets := e.tickets(c.sector.ID); len(tickets) != 1 {
		t.Fatalf("tickets = %+v", tickets)
	}

	// Outra pessoa assume e responde; o horário da primeira vez não muda.
	if resp := e.assign(c.ticket.ID, c.biaToken); resp.status != http.StatusOK {
		t.Fatalf("assign after return: status %d, body %v", resp.status, resp.body)
	}
	assigned := e.assignment(c.ticket.ID)
	if assigned.Status != "in_progress" || *assigned.AssigneeID != bia || !assigned.AssignedAt.Equal(*before.AssignedAt) {
		t.Fatalf("assignment after new assign = %+v (before %+v)", assigned, before)
	}
	if resp := e.sendText(c.ticket.ID, c.biaToken, requestC, "Assumi o seu atendimento."); resp.status != http.StatusOK {
		t.Fatalf("new assignee sending: status %d, body %v", resp.status, resp.body)
	}

	// Auditoria com a situação e o responsável, e quem fez.
	actions, changes := c.ticketActions()
	if len(actions) != 3 || actions[0] != "ticket_assigned" || actions[1] != "ticket_returned" || actions[2] != "ticket_assigned" {
		t.Fatalf("audit actions = %v", actions)
	}
	returned := changes[1]
	if len(returned) != 2 || returned["status"]["from"] != "in_progress" || returned["status"]["to"] != "queued" ||
		returned["assignee_id"]["from"] != float64(c.ana.ID) || returned["assignee_id"]["to"] != nil {
		t.Fatalf("return changes = %v", returned)
	}
	var actor int64
	if err := e.pool.QueryRow(t.Context(),
		"select actor_id from audit_logs where ticket_id = $1 and action = 'ticket_returned'", c.ticket.ID).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if actor != c.ana.ID {
		t.Fatalf("return actor = %d", actor)
	}

	// A conversa mostra a devolução, com quem fez e de quem era o chamado.
	logs := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.supToken)
	if len(logs) != 3 {
		t.Fatalf("assignments = %v", logs)
	}
	if logs[1]["action"] != "ticket_returned" || logs[1]["fromName"] != "ana@exemplo.com" || logs[1]["toName"] != nil ||
		logs[1]["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("return log = %v", logs[1])
	}
	if logs[2]["action"] != "ticket_assigned" || logs[2]["toName"] != "bia@exemplo.com" {
		t.Fatalf("second assignment log = %v", logs[2])
	}
}

func TestReturnToQueuePermissions(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rhSector := e.userSector("rh@exemplo.com")
	e.user("suprh@exemplo.com", db.UserRoleSupervisor, rhSector)
	supRHToken := e.login("suprh@exemplo.com", testPassword)

	// Chamado na fila é recusado, mesmo para a supervisão.
	if resp := e.returnToQueue(c.ticket.ID, c.supToken); resp.status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.status)
	}
	c.assign()
	if actions, _ := c.ticketActions(); len(actions) != 1 {
		t.Fatalf("audit actions = %v", actions)
	}

	// Atendente que não é o responsável é bloqueado; outro setor não acessa.
	for name, token := range map[string]string{
		"another agent": c.biaToken, "agent of another sector": c.rhToken, "supervisor of another sector": supRHToken,
	} {
		if resp := e.returnToQueue(c.ticket.ID, token); resp.status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.status)
		}
	}
	if resp := e.returnToQueue(c.ticket.ID, ""); resp.status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.status)
	}
	if resp := e.returnToQueue(999999, c.adminToken); resp.status != http.StatusNotFound {
		t.Fatalf("unknown ticket: status %d", resp.status)
	}
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" || *got.AssigneeID != c.ana.ID {
		t.Fatalf("refused returns changed the ticket: %+v", got)
	}
	if actions, _ := c.ticketActions(); len(actions) != 1 {
		t.Fatalf("refused returns recorded audit: %v", actions)
	}

	// Supervisor e administrador devolvem o chamado de outro atendente.
	if resp := e.returnToQueue(c.ticket.ID, c.supToken); resp.status != http.StatusOK {
		t.Fatalf("supervisor: status %d, body %v", resp.status, resp.body)
	}
	c.assign()
	if resp := e.returnToQueue(c.ticket.ID, c.adminToken); resp.status != http.StatusOK {
		t.Fatalf("admin: status %d, body %v", resp.status, resp.body)
	}

	// Repetir a devolução é recusado e não grava de novo.
	if resp := e.returnToQueue(c.ticket.ID, c.adminToken); resp.status != http.StatusConflict {
		t.Fatalf("repeated return: status %d", resp.status)
	}
	actions, _ := c.ticketActions()
	if len(actions) != 4 || actions[1] != "ticket_returned" || actions[3] != "ticket_returned" {
		t.Fatalf("audit actions = %v", actions)
	}

	// Chamado encerrado ou cancelado é recusado.
	c.assign()
	e.closeTicket(c.ticket.ID, c.ana.ID, e.organization(c.supToken, "Prefeitura", ""))
	if resp := e.returnToQueue(c.ticket.ID, c.anaToken); resp.status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", resp.status)
	}
	other := e.queuedTicket(c.sector.ID, "MSG-OUTRO", "5511977776666")
	if resp := e.cancel(other.ID, c.supToken, "Engano."); resp.status != http.StatusOK {
		t.Fatalf("cancel: status %d", resp.status)
	}
	if resp := e.returnToQueue(other.ID, c.supToken); resp.status != http.StatusConflict {
		t.Fatalf("cancelled ticket: status %d", resp.status)
	}
}

func TestOnlyOneConcurrentReturnWins(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	const attempts = 8
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i := range statuses {
		wg.Go(func() {
			<-start
			statuses[i] = e.returnToQueue(c.ticket.ID, c.anaToken).status
		})
	}
	close(start)
	wg.Wait()

	won := 0
	for _, status := range statuses {
		switch status {
		case http.StatusOK:
			won++
		case http.StatusConflict:
		default:
			t.Fatalf("unexpected status %d: %v", status, statuses)
		}
	}
	if won != 1 {
		t.Fatalf("returns that won: %d (%v)", won, statuses)
	}
	if actions, _ := c.ticketActions(); len(actions) != 2 {
		t.Fatalf("audit actions = %v", actions)
	}
}

// Devolver cruza com outra pessoa assumindo e com o encerramento por
// cancelamento: o estado final e a auditoria seguem a ordem que o banco decidiu.
func TestReturnDoesNotCrossAssignOrCancel(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	bia := e.userID("bia@exemplo.com")
	c.assign()

	var returned, assigned, cancelled int
	var wg sync.WaitGroup
	start := make(chan struct{})
	wg.Go(func() {
		<-start
		returned = e.returnToQueue(c.ticket.ID, c.anaToken).status
	})
	wg.Go(func() {
		<-start
		assigned = e.assign(c.ticket.ID, c.biaToken).status
	})
	wg.Go(func() {
		<-start
		cancelled = e.cancel(c.ticket.ID, c.supToken, "Engano.").status
	})
	close(start)
	wg.Wait()

	// O registro segue a ordem da trava: cada linha da auditoria é uma mudança aplicada.
	actions, _ := c.ticketActions()
	state := "in_progress"
	assignee := c.ana.ID
	for _, action := range actions[1:] {
		switch action {
		case "ticket_returned":
			if state != "in_progress" {
				t.Fatalf("returned from %s: %v", state, actions)
			}
			state, assignee = "queued", 0
		case "ticket_assigned":
			if state != "queued" {
				t.Fatalf("assigned from %s: %v", state, actions)
			}
			state, assignee = "in_progress", bia
		case "ticket_cancelled":
			if state == "closed" {
				t.Fatalf("cancelled twice: %v", actions)
			}
			state = "closed"
		default:
			t.Fatalf("unexpected action %s", action)
		}
	}
	got := e.assignment(c.ticket.ID)
	if got.Status != state {
		t.Fatalf("status %s, audit says %s: %v (return %d, assign %d, cancel %d)", got.Status, state, actions, returned, assigned, cancelled)
	}
	if state == "queued" && got.AssigneeID != nil {
		t.Fatalf("queued with assignee: %+v", got)
	}
	if state == "in_progress" && *got.AssigneeID != assignee {
		t.Fatalf("assignee %d, audit says %d", *got.AssigneeID, assignee)
	}
}
