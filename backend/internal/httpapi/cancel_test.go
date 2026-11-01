package httpapi

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

func (e *testEnv) cancel(ticketID int64, token, reason string) response {
	e.t.Helper()
	return e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/cancel", ticketID), token, map[string]any{"reason": reason})
}

// cancelled reads the columns the cancellation writes.
type cancelled struct {
	status, closure      string
	assignee, closedBy   *int64
	organization         *int64
	subject, resolution  *string
	assignedSet, endedOK bool
}

func (e *testEnv) cancelled(ticketID int64) cancelled {
	e.t.Helper()
	var c cancelled
	err := e.pool.QueryRow(e.t.Context(), `
		select status, coalesce(closure_type::text, ''), assignee_id, closed_by_id, organization_id, subject, resolution,
		       assigned_at is not null, ended_at is not null and closed_at is not null and ended_at >= started_at
		from tickets where id = $1`, ticketID).
		Scan(&c.status, &c.closure, &c.assignee, &c.closedBy, &c.organization, &c.subject, &c.resolution, &c.assignedSet, &c.endedOK)
	if err != nil {
		e.t.Fatal(err)
	}
	return c
}

func TestCancelFromTheQueueWithoutAssigning(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	bia := e.userID("bia@exemplo.com")

	// Contato não cadastrado e sem órgão, na fila: quem é do setor cancela sem assumir.
	events := e.subscribe(c.supToken)
	resp := e.cancel(c.ticket.ID, c.biaToken, "  Golpe do falso boleto.  ")
	if resp.status != http.StatusOK || resp.body["status"] != "closed" {
		t.Fatalf("cancel: status %d, body %v", resp.status, resp.body)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	got := e.cancelled(c.ticket.ID)
	if got.status != "closed" || got.closure != "cancelled" || !got.endedOK {
		t.Fatalf("ticket = %+v", got)
	}
	if got.assignee == nil || *got.assignee != bia || got.closedBy == nil || *got.closedBy != bia || got.assignedSet {
		t.Fatalf("assignee = %v, closed by %v, assigned %v", got.assignee, got.closedBy, got.assignedSet)
	}
	if got.organization != nil || got.subject != nil || got.resolution != nil {
		t.Fatalf("closing data recorded: %+v", got)
	}

	// A auditoria grava o motivo e a origem na fila.
	actions, changes := c.ticketActions()
	if len(actions) != 1 || actions[0] != "ticket_cancelled" {
		t.Fatalf("audit actions = %v", actions)
	}
	last := changes[0]
	if last["status"]["from"] != "queued" || last["status"]["to"] != "closed" ||
		last["closure_type"]["to"] != "cancelled" || last["ended_at"]["to"] == nil ||
		last["assignee_id"]["from"] != nil || last["assignee_id"]["to"] != float64(bia) {
		t.Fatalf("changes = %v", last)
	}

	// A conversa mostra quem cancelou e o motivo, sem espaços nas pontas.
	logs := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.anaToken)
	if len(logs) != 1 || logs[0]["action"] != "ticket_cancelled" || logs[0]["reason"] != "Golpe do falso boleto." ||
		logs[0]["actor"].(map[string]any)["id"] != float64(bia) {
		t.Fatalf("logs = %v", logs)
	}
	// Detalhes, histórico e realizados identificam o cancelado.
	detail := e.do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil)
	if detail.status != http.StatusOK || detail.body["closureType"] != "cancelled" {
		t.Fatalf("detail: status %d, body %v", detail.status, detail.body)
	}
	history := e.doList(http.MethodGet, fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID), c.anaToken)
	if len(history) != 1 || history[0]["closureType"] != "cancelled" {
		t.Fatalf("history = %v", history)
	}
	done := e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/closed-today", c.sector.ID), c.anaToken)
	if len(done) != 1 || done[0]["closureType"] != "cancelled" || done[0]["organizationName"] != nil ||
		done[0]["closedBy"].(map[string]any)["id"] != float64(bia) {
		t.Fatalf("closed today = %v", done)
	}

	// Notas internas continuam permitidas.
	note := e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/notes", c.ticket.ID), c.anaToken, map[string]any{"body": "Número bloqueado."})
	if note.status >= http.StatusMultipleChoices {
		t.Fatalf("note: status %d, body %v", note.status, note.body)
	}
}

func TestCancelPermissions(t *testing.T) {
	t.Parallel()

	t.Run("queue", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		e := c.e
		if resp := e.cancel(c.ticket.ID, c.rhToken, "Engano."); resp.status != http.StatusForbidden {
			t.Fatalf("other sector: status %d", resp.status)
		}
		if resp := e.cancel(c.ticket.ID, "", "Engano."); resp.status != http.StatusUnauthorized {
			t.Fatalf("without session: status %d", resp.status)
		}
		if got := e.cancelled(c.ticket.ID); got.status != "queued" {
			t.Fatalf("status = %q", got.status)
		}
	})

	t.Run("in progress, agent who is not the assignee", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		e := c.e
		c.assign()
		resp := e.cancel(c.ticket.ID, c.biaToken, "Engano.")
		if resp.status != http.StatusForbidden || resp.body["error"] != "Apenas o responsável pelo chamado ou a supervisão do setor pode cancelá-lo." {
			t.Fatalf("agent: status %d, body %v", resp.status, resp.body)
		}
		if resp := e.cancel(c.ticket.ID, c.rhToken, "Engano."); resp.status != http.StatusForbidden {
			t.Fatalf("other sector: status %d", resp.status)
		}
		if got := e.cancelled(c.ticket.ID); got.status != "in_progress" {
			t.Fatalf("status = %q", got.status)
		}
		if actions, _ := c.ticketActions(); len(actions) != 1 || actions[0] != "ticket_assigned" {
			t.Fatalf("audit actions = %v", actions)
		}
	})

	for name, token := range map[string]func(conversation) string{
		"assignee":   func(c conversation) string { return c.anaToken },
		"supervisor": func(c conversation) string { return c.supToken },
		"admin":      func(c conversation) string { return c.adminToken },
	} {
		t.Run("in progress, "+name, func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			c.assign()
			if resp := e.cancel(c.ticket.ID, token(c), "Engano."); resp.status != http.StatusOK {
				t.Fatalf("status %d, body %v", resp.status, resp.body)
			}
			// O responsável continua o mesmo e quem cancelou fica registrado.
			got := e.cancelled(c.ticket.ID)
			if got.closure != "cancelled" || *got.assignee != c.ana.ID || !got.assignedSet {
				t.Fatalf("ticket = %+v", got)
			}
			_, changes := c.ticketActions()
			if _, ok := changes[len(changes)-1]["assignee_id"]; ok {
				t.Fatalf("assignee in the audit: %v", changes[len(changes)-1])
			}
		})
	}
}

func TestCancelRequiresReason(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	for name, body := range map[string]map[string]any{
		"no reason": {}, "empty": {"reason": ""}, "blank": {"reason": " \n "},
	} {
		resp := e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/cancel", c.ticket.ID), c.anaToken, body)
		if resp.status != http.StatusUnprocessableEntity || resp.body["error"] != "Informe o motivo do cancelamento." {
			t.Fatalf("%s: status %d, body %v", name, resp.status, resp.body)
		}
	}
	if got := e.cancelled(c.ticket.ID); got.status != "queued" {
		t.Fatalf("status = %q", got.status)
	}

	// O banco também recusa cancelamento sem motivo.
	_, err := e.pool.Exec(t.Context(), `
		insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, changes)
		values ($1, 'ticket', $1, 'ticket_cancelled', $2, '{}')`, c.ticket.ID, c.ana.ID)
	if err == nil {
		t.Fatal("cancellation without reason accepted by the database")
	}
	// E exige os dados do encerramento de quem não foi cancelado.
	_, err = e.pool.Exec(t.Context(), `
		update tickets set status = 'closed', assignee_id = $2, closed_by_id = $2, closure_type = 'resolved', closed_at = now(), ended_at = now()
		where id = $1`, c.ticket.ID, c.ana.ID)
	if err == nil {
		t.Fatal("closing without the form accepted by the database")
	}
}

func TestClosedTicketIsNotCancelled(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.cancel(c.ticket.ID, c.supToken, "Engano."); resp.status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d", resp.status)
	}
	if got := e.cancelled(c.ticket.ID); got.closure != "resolved" {
		t.Fatalf("closure = %q", got.closure)
	}
}

func TestCancelledTicketIsNotCorrected(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	if resp := e.cancel(c.ticket.ID, c.anaToken, "Spam."); resp.status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.status, resp.body)
	}

	body := with(c.form(c.org), "reason", "Motivo.")
	body["startedAt"] = c.ticket.ArrivedAt
	body["endedAt"] = c.ticket.ArrivedAt
	for name, token := range map[string]string{"who cancelled": c.anaToken, "supervisor": c.supToken, "admin": c.adminToken} {
		resp := e.correct(c.ticket.ID, token, body)
		if resp.status != http.StatusConflict || resp.body["error"] != "Chamado cancelado não é corrigido." {
			t.Fatalf("%s: status %d, body %v", name, resp.status, resp.body)
		}
	}
	if got := e.cancelled(c.ticket.ID); got.subject != nil {
		t.Fatalf("subject = %v", *got.subject)
	}
}

func TestMessageAfterCancellingOpensNewTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	if resp := e.cancel(c.ticket.ID, c.anaToken, "Engano."); resp.status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.status, resp.body)
	}

	e.receive(c.sector.ID, text("MSG-9", "5511988887777@s.whatsapp.net", "5511988887777", "Outra dúvida"))
	tickets := e.tickets(c.sector.ID)
	if len(tickets) != 2 || tickets[0].ID != c.ticket.ID || tickets[0].Status != "closed" || tickets[1].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	if got := len(e.messages(c.ticket.ID)); got != 1 {
		t.Fatalf("messages of the cancelled ticket = %d", got)
	}
}

// Quem não é responsável só cancela se chegar antes de quem assume: sempre
// exatamente uma das duas ações vence, e o chamado fica coerente com ela.
func TestCancelDoesNotCrossAssigning(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	var assign, cancel response
	var wg sync.WaitGroup
	wg.Go(func() { assign = e.assign(c.ticket.ID, c.anaToken) })
	wg.Go(func() { cancel = e.cancel(c.ticket.ID, c.biaToken, "Spam.") })
	wg.Wait()

	got := e.cancelled(c.ticket.ID)
	actions, _ := c.ticketActions()
	switch {
	case assign.status == http.StatusOK && cancel.status == http.StatusForbidden:
		if got.status != "in_progress" || *got.assignee != c.ana.ID || len(actions) != 1 || actions[0] != "ticket_assigned" {
			t.Fatalf("assign won: ticket %+v, audit %v", got, actions)
		}
	case assign.status == http.StatusConflict && cancel.status == http.StatusOK:
		if got.closure != "cancelled" || got.assignedSet || len(actions) != 1 || actions[0] != "ticket_cancelled" {
			t.Fatalf("cancel won: ticket %+v, audit %v", got, actions)
		}
	default:
		t.Fatalf("assign %d, cancel %d", assign.status, cancel.status)
	}
}

func TestConcurrentCancellingCancelsOnce(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	const attempts = 5
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = e.cancel(c.ticket.ID, c.anaToken, "Spam.").status
		})
	}
	wg.Wait()
	ok := 0
	for _, s := range statuses {
		switch s {
		case http.StatusOK:
			ok++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v", statuses)
		}
	}
	if ok != 1 {
		t.Fatalf("statuses = %v, want one success", statuses)
	}
	if actions, _ := c.ticketActions(); len(actions) != 1 {
		t.Fatalf("audit actions = %v", actions)
	}
}

// A mensagem que chega durante o cancelamento entra no chamado antes dele ou
// abre outro; nunca entra no chamado cancelado depois de finalizado.
func TestCancelDoesNotCrossNewMessage(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e

	var cancel response
	var wg sync.WaitGroup
	wg.Go(func() { cancel = e.cancel(c.ticket.ID, c.anaToken, "Spam.") })
	wg.Go(func() {
		e.receive(c.sector.ID, text("MSG-9", "5511988887777@s.whatsapp.net", "5511988887777", "Mais uma"))
	})
	wg.Wait()
	if cancel.status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", cancel.status, cancel.body)
	}

	tickets := e.tickets(c.sector.ID)
	messages := len(e.messages(c.ticket.ID))
	switch {
	case len(tickets) == 1 && messages == 2 && tickets[0].Status == "closed":
	case len(tickets) == 2 && messages == 1 && tickets[0].Status == "closed" && tickets[1].Status == "queued":
		if got := len(e.messages(tickets[1].ID)); got != 1 {
			t.Fatalf("messages of the new ticket = %d", got)
		}
	default:
		t.Fatalf("tickets = %+v, messages of the cancelled ticket = %d", tickets, messages)
	}
}
