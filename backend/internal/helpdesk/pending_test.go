package helpdesk_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
)

func (e *testEnv) markPending(ticketID int64, token, reason string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/pending", ticketID), token, map[string]any{"reason": reason})
}

// pendingState is what the ticket keeps of being pending.
type pendingState struct {
	Status     string
	AssigneeID *int64
	AssignedAt *time.Time
	Reason     *string
	ByID       *int64
	At         *time.Time
}

func (e *testEnv) pendingState(ticketID int64) pendingState {
	e.T.Helper()
	var p pendingState
	if err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, assignee_id, assigned_at, pending_reason, pending_by_id, pending_at
		from tickets where id = $1`, ticketID).
		Scan(&p.Status, &p.AssigneeID, &p.AssignedAt, &p.Reason, &p.ByID, &p.At); err != nil {
		e.T.Fatal(err)
	}
	return p
}

// queueIDs lists the tickets of the queue panel of the sector, where the
// Fila and Meus chamados come from.
func (e *testEnv) queueIDs(sectorID int64, token string) []int64 {
	e.T.Helper()
	out := []int64{}
	for _, t := range e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", sectorID), token) {
		out = append(out, int64(t["id"].(float64)))
	}
	return out
}

func (c conversation) markPending(reason string) {
	c.e.T.Helper()
	if resp := c.e.markPending(c.ticket.ID, c.anaToken, reason); resp.Status != http.StatusOK {
		c.e.T.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestAssigneeMarksTicketAsPending(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Vou verificar com o desenvolvimento."); resp.Status != http.StatusOK {
		t.Fatalf("send: status %d", resp.Status)
	}
	before := e.pendingState(c.ticket.ID)
	sent := len(e.WhatsApp.SentMessages())

	events := e.subscribe(c.supToken)
	resp := e.markPending(c.ticket.ID, c.anaToken, "  Aguardando ajuste no sistema de folha  ")
	if resp.Status != http.StatusOK || resp.Body["status"] != "pending" || resp.Body["assigneeId"] != nil ||
		resp.Body["reason"] != "Aguardando ajuste no sistema de folha" {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	// O setor é avisado depois do commit.
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	// Pendente, sem responsável, com motivo, quem marcou e quando; o horário
	// em que foi assumido não muda e a leitura é limpa, como na volta à fila.
	got := e.pendingState(c.ticket.ID)
	if got.Status != "pending" || got.AssigneeID != nil || !got.AssignedAt.Equal(*before.AssignedAt) ||
		got.Reason == nil || *got.Reason != "Aguardando ajuste no sistema de folha" ||
		got.ByID == nil || *got.ByID != c.ana.ID || got.At == nil || time.Since(*got.At) > time.Minute {
		t.Fatalf("pending ticket = %+v (before %+v)", got, before)
	}
	if at := e.readAt(c.ticket.ID); at != nil {
		t.Fatalf("reading of the pending ticket = %v, want null", at)
	}

	// Nada é enviado ao cliente.
	if n := len(e.WhatsApp.SentMessages()); n != sent {
		t.Fatalf("sent to provider = %d, want %d", n, sent)
	}

	// Sai de Meus chamados e não entra na Fila: o painel do setor não o lista.
	for name, token := range map[string]string{"assignee": c.anaToken, "agent": c.biaToken, "supervisor": c.supToken} {
		if ids := e.queueIDs(c.sector.ID, token); len(ids) != 0 {
			t.Fatalf("%s: queue panel = %v", name, ids)
		}
	}

	// Auditoria com o motivo, a situação e o responsável, e quem fez.
	var reason string
	var actor int64
	var raw []byte
	if err := e.Pool.QueryRow(t.Context(), `
		select reason, actor_id, changes from audit_logs
		where ticket_id = $1 and action = 'ticket_pending'`, c.ticket.ID).Scan(&reason, &actor, &raw); err != nil {
		t.Fatal(err)
	}
	var changes map[string]map[string]any
	if err := json.Unmarshal(raw, &changes); err != nil {
		t.Fatal(err)
	}
	if reason != "Aguardando ajuste no sistema de folha" || actor != c.ana.ID || len(changes) != 2 ||
		changes["status"]["from"] != "in_progress" || changes["status"]["to"] != "pending" ||
		changes["assignee_id"]["from"] != float64(c.ana.ID) || changes["assignee_id"]["to"] != nil {
		t.Fatalf("audit = %q by %d, changes %v", reason, actor, changes)
	}

	// O detalhe traz o pendente para o setor, com a conversa completa.
	for name, token := range map[string]string{"assignee": c.anaToken, "agent": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken} {
		resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), token, nil)
		pending, _ := resp.Body["pending"].(map[string]any)
		if resp.Status != http.StatusOK || resp.Body["status"] != "pending" || resp.Body["assignee"] != nil || pending == nil ||
			pending["reason"] != "Aguardando ajuste no sistema de folha" ||
			pending["by"].(map[string]any)["name"] != "ana@exemplo.com" || pending["at"] == nil {
			t.Fatalf("%s: detail status %d, body %v", name, resp.Status, resp.Body)
		}
		if msgs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), token); len(msgs) != 2 {
			t.Fatalf("%s: messages = %v", name, msgs)
		}
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.rhToken, nil); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of another sector: detail status %d", resp.Status)
	}
}

func TestMarkPendingRefusalsChangeNothing(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	audits := func() int {
		var n int
		if err := e.Pool.QueryRow(t.Context(), "select count(*) from audit_logs where ticket_id = $1", c.ticket.ID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}

	// Na fila: é preciso assumir antes.
	if resp := e.markPending(c.ticket.ID, c.supToken, "Aguardando"); resp.Status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d, body %v", resp.Status, resp.Body)
	}
	c.assign()
	want := e.pendingState(c.ticket.ID)
	n := audits()

	// Sem motivo, ou só com espaços.
	for _, reason := range []string{"", "   ", "\n\t"} {
		if resp := e.markPending(c.ticket.ID, c.anaToken, reason); resp.Status != http.StatusUnprocessableEntity {
			t.Fatalf("reason %q: status %d, body %v", reason, resp.Status, resp.Body)
		}
	}
	// Só o responsável: outro atendente, a supervisão e o administrador também são recusados.
	for name, token := range map[string]string{
		"another agent": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "agent of another sector": c.rhToken,
	} {
		if resp := e.markPending(c.ticket.ID, token, "Aguardando"); resp.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if resp := e.markPending(c.ticket.ID, "", "Aguardando"); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	if resp := e.markPending(999999, c.anaToken, "Aguardando"); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown ticket: status %d", resp.Status)
	}
	if got := e.pendingState(c.ticket.ID); got.Status != "in_progress" || *got.AssigneeID != c.ana.ID || got.Reason != nil || audits() != n {
		t.Fatalf("refusals changed the ticket: %+v (want %+v), audits %d", got, want, audits())
	}

	// Já pendente.
	c.markPending("Aguardando o cliente")
	marked := e.pendingState(c.ticket.ID)
	n = audits()
	for name, token := range map[string]string{"who marked": c.anaToken, "supervisor": c.supToken} {
		if resp := e.markPending(c.ticket.ID, token, "De novo"); resp.Status != http.StatusConflict {
			t.Fatalf("pending ticket, %s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if got := e.pendingState(c.ticket.ID); *got.Reason != "Aguardando o cliente" || !got.At.Equal(*marked.At) || audits() != n {
		t.Fatalf("pending ticket changed: %+v", got)
	}

	// Encerrado.
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	closed := e.tickets(c.sector.ID)[1]
	if resp := e.assign(closed.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.cancel(closed.ID, c.anaToken, "Engano"); resp.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.markPending(closed.ID, c.anaToken, "Aguardando"); resp.Status != http.StatusConflict {
		t.Fatalf("closed ticket: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.pendingState(closed.ID); got.Status != "closed" || got.Reason != nil {
		t.Fatalf("closed ticket changed: %+v", got)
	}
}

// Com só pendentes no setor, a mensagem do cliente ou a enviada pelo celular
// do setor abre um chamado novo na fila; o pendente não a recebe. O contato
// pode ter vários pendentes e, ao mesmo tempo, um chamado na fila ou em
// atendimento.
func TestMessageWithOnlyPendingTicketsOpensANewOne(t *testing.T) {
	t.Parallel()
	for _, origin := range []string{"customer", "phone"} {
		t.Run(origin, func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			deliver := func(id, body string) {
				msg := text(id, "5511988887777@s.whatsapp.net", "5511988887777", body)
				if origin == "phone" {
					e.sendOutside(c.sector.ID, msg)
				} else {
					e.receive(c.sector.ID, msg)
				}
			}
			c.assign()
			c.markPending("Aguardando ajuste")

			deliver("MSG-2", "Outro assunto")
			tickets := e.tickets(c.sector.ID)
			if len(tickets) != 2 || tickets[0].Status != "pending" || tickets[1].Status != "queued" ||
				tickets[1].ContactID != c.ticket.ContactID {
				t.Fatalf("tickets = %+v", tickets)
			}
			second := tickets[1]
			if msgs := e.messages(c.ticket.ID); len(msgs) != 1 || *msgs[0].ExternalMessageID != "MSG-1" {
				t.Fatalf("pending messages = %+v", msgs)
			}
			if msgs := e.messages(second.ID); len(msgs) != 1 || *msgs[0].ExternalMessageID != "MSG-2" {
				t.Fatalf("new ticket messages = %+v", msgs)
			}
			if ids := e.queueIDs(c.sector.ID, c.biaToken); len(ids) != 1 || ids[0] != second.ID {
				t.Fatalf("queue panel = %v", ids)
			}

			// O segundo também fica pendente; a próxima mensagem abre um terceiro.
			if resp := e.assign(second.ID, c.anaToken); resp.Status != http.StatusOK {
				t.Fatalf("assign second: status %d", resp.Status)
			}
			if resp := e.markPending(second.ID, c.anaToken, "Aguardando o cliente"); resp.Status != http.StatusOK {
				t.Fatalf("mark second pending: status %d, body %v", resp.Status, resp.Body)
			}
			deliver("MSG-3", "Mais um assunto")
			deliver("MSG-4", "Continuando")
			tickets = e.tickets(c.sector.ID)
			if len(tickets) != 3 || tickets[0].Status != "pending" || tickets[1].Status != "pending" || tickets[2].Status != "queued" {
				t.Fatalf("tickets = %+v", tickets)
			}
			if msgs := e.messages(tickets[2].ID); len(msgs) != 2 {
				t.Fatalf("open ticket messages = %+v", msgs)
			}
			for _, p := range tickets[:2] {
				if msgs := e.messages(p.ID); len(msgs) != 1 {
					t.Fatalf("pending %d messages = %+v", p.ID, msgs)
				}
			}

			// Em atendimento, continua recebendo, ao lado dos dois pendentes.
			if resp := e.assign(tickets[2].ID, c.biaToken); resp.Status != http.StatusOK {
				t.Fatalf("assign third: status %d", resp.Status)
			}
			deliver("MSG-5", "Obrigado")
			if got := e.tickets(c.sector.ID); len(got) != 3 || len(e.messages(tickets[2].ID)) != 3 {
				t.Fatalf("tickets = %+v", got)
			}
		})
	}
}

// Edição, exclusão e reação do cliente sobre mensagem de um pendente
// atualizam a mensagem no próprio pendente, sem abrir chamado novo.
func TestChangesFromWhatsAppUpdateThePendingTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste")
	at := time.Now().Truncate(time.Microsecond).Add(time.Minute)

	e.react(c.sector.ID, "MSG-1", "👍", at)
	e.edit(c.sector.ID, "EV-1", "MSG-1", "Oi, editado", at.Add(time.Second))
	e.revoke(c.sector.ID, "RV-1", "MSG-1", false, at.Add(2*time.Second))

	if tickets := e.tickets(c.sector.ID); len(tickets) != 1 || tickets[0].Status != "pending" {
		t.Fatalf("tickets = %+v", tickets)
	}
	m := e.apiMessage(c.ticket.ID, c.biaToken, "MSG-1")
	if bodyOf(t, m) != "Oi, editado" || deletionOf(t, m)["scope"] != "everyone" {
		t.Fatalf("message = %v", m)
	}
	if emoji := emojiOf(t, e.reactionsOf(c.ticket.ID, c.biaToken, "MSG-1")["customer"]); emoji != "👍" {
		t.Fatalf("customer reaction = %q", emoji)
	}
}

// Envio, edição, exclusão e reação pelo painel são recusados no pendente, e
// também encerrar, cancelar, devolver à fila, assumir e as duas
// transferências.
func TestPanelActionsOnPendingTicketAreRefused(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto")
	if resp.Status != http.StatusOK {
		t.Fatalf("send: status %d", resp.Status)
	}
	sentID := int64(resp.Body["id"].(float64))
	customerID := e.messageID(c.ticket.ID, "MSG-1")
	c.markPending("Aguardando ajuste")
	before := e.pendingState(c.ticket.ID)
	sent, reactions := len(e.WhatsApp.SentMessages()), len(e.sentReactions())
	rh := e.userSector("rh@exemplo.com")

	for name, try := range map[string]func(token string) response{
		"send":            func(tk string) response { return e.sendText(c.ticket.ID, tk, requestB, "Ainda aqui") },
		"edit":            func(tk string) response { return e.editMessage(sentID, tk, requestE1, "Segue o boleto corrigido") },
		"delete":          func(tk string) response { return e.deleteMessage(sentID, tk, requestE2, "everyone") },
		"react":           func(tk string) response { return e.reactTo(customerID, tk, "👍") },
		"close":           func(tk string) response { return e.closeForm(c.ticket.ID, tk, c.form(c.org)) },
		"cancel":          func(tk string) response { return e.cancel(c.ticket.ID, tk, "Engano") },
		"return":          func(tk string) response { return e.returnToQueue(c.ticket.ID, tk) },
		"assign":          func(tk string) response { return e.assign(c.ticket.ID, tk) },
		"transfer":        func(tk string) response { return e.transfer(c.ticket.ID, e.userID("bia@exemplo.com"), tk) },
		"sector transfer": func(tk string) response { return e.sectorTransfer(c.ticket.ID, tk, map[string]any{"sectorId": *rh}) },
	} {
		for who, token := range map[string]string{"who marked": c.anaToken, "supervisor": c.supToken, "admin": c.adminToken} {
			if resp := try(token); resp.Status != http.StatusConflict {
				t.Errorf("%s by %s: status %d, body %v", name, who, resp.Status, resp.Body)
			}
		}
	}

	if got := e.pendingState(c.ticket.ID); got.Status != "pending" || got.AssigneeID != nil || !got.At.Equal(*before.At) || *got.Reason != *before.Reason {
		t.Fatalf("refused actions changed the ticket: %+v (before %+v)", got, before)
	}
	if n, r := len(e.WhatsApp.SentMessages()), len(e.sentReactions()); n != sent || r != reactions || len(e.sentChanges()) != 0 {
		t.Fatalf("sent to provider: messages %d (want %d), reactions %d (want %d), changes %v", n, sent, r, reactions, e.sentChanges())
	}
	if tickets := e.tickets(c.sector.ID); len(tickets) != 1 {
		t.Fatalf("tickets = %+v", tickets)
	}
	var actions int
	if err := e.Pool.QueryRow(t.Context(),
		"select count(*) from audit_logs where ticket_id = $1 and action not in ('ticket_assigned', 'ticket_pending')", c.ticket.ID).Scan(&actions); err != nil {
		t.Fatal(err)
	}
	if actions != 0 {
		t.Fatalf("refused actions recorded %d audit logs", actions)
	}
}

// Uma mensagem que espera a trava do chamado enquanto o responsável o marca
// como pendente não entra nele: abre um chamado novo na fila.
func TestMessageWaitingWhileMarkingPendingOpensAQueuedTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()

	// O teste segura o chamado: marcar como pendente espera, e a mensagem,
	// que chega depois, espera atrás dele.
	tx, err := e.Pool.Begin(t.Context())
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(t.Context()) }()
	if _, err := tx.Exec(t.Context(), "select id from tickets where id = $1 for update", c.ticket.ID); err != nil {
		t.Fatal(err)
	}
	marked := make(chan response, 1)
	go func() { marked <- e.markPending(c.ticket.ID, c.anaToken, "Aguardando ajuste") }()
	e.waitTicketLockWaiters(1)
	received := make(chan error, 1)
	go func() {
		received <- e.WhatsApp.Receive(t.Context(), c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	}()
	e.waitTicketLockWaiters(2)
	if err := tx.Rollback(t.Context()); err != nil {
		t.Fatal(err)
	}
	if resp := <-marked; resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	if err := <-received; err != nil {
		t.Fatal(err)
	}

	tickets := e.tickets(c.sector.ID)
	if len(tickets) != 2 || tickets[0].Status != "pending" || tickets[1].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	if msgs := e.messages(c.ticket.ID); len(msgs) != 1 {
		t.Fatalf("pending messages = %+v", msgs)
	}
	if msgs := e.messages(tickets[1].ID); len(msgs) != 1 || *msgs[0].ExternalMessageID != "MSG-2" {
		t.Fatalf("new ticket messages = %+v", msgs)
	}
}

// Mensagens e marcar como pendente ao mesmo tempo: cada mensagem entra uma
// vez só, no chamado em atendimento (antes de ele ficar pendente) ou num
// único chamado novo na fila. Que nenhuma entra no chamado depois de ele
// ficar pendente, o teste acima prova com a ordem fixada.
func TestConcurrentMessagesAndMarkingPending(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			c.assign()

			var wg sync.WaitGroup
			var marked response
			errs := make(chan error, 3)
			wg.Go(func() { marked = e.markPending(c.ticket.ID, c.anaToken, "Aguardando ajuste") })
			for _, id := range []string{"MSG-2", "MSG-3", "MSG-2"} {
				wg.Go(func() {
					errs <- e.WhatsApp.Receive(t.Context(), c.sector.ID, text(id, "5511988887777@s.whatsapp.net", "5511988887777", "Corrida "+id))
				})
			}
			wg.Wait()
			close(errs)
			for err := range errs {
				if err != nil {
					t.Fatal(err)
				}
			}
			if marked.Status != http.StatusOK {
				t.Fatalf("mark pending: status %d, body %v", marked.Status, marked.Body)
			}

			tickets := e.tickets(c.sector.ID)
			if len(tickets) > 2 || tickets[0].Status != "pending" || (len(tickets) == 2 && tickets[1].Status != "queued") {
				t.Fatalf("tickets = %+v", tickets)
			}
			seen := map[string]int64{}
			for _, tk := range tickets {
				for _, m := range e.messages(tk.ID) {
					if _, dup := seen[*m.ExternalMessageID]; dup {
						t.Fatalf("message %s recorded twice", *m.ExternalMessageID)
					}
					seen[*m.ExternalMessageID] = tk.ID
				}
			}
			if len(seen) != 3 {
				t.Fatalf("messages = %v", seen)
			}
		})
	}
}

// Dashboard "Agora": o pendente não conta em "Na fila" nem em "Em atendimento",
// nem aparece na lista dos chamados de agora.
func TestDashboardDoesNotCountPendingTickets(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	numbers := func() map[string]any {
		resp := e.Do(http.MethodGet, fmt.Sprintf("/api/dashboard?sectorId=%d", c.sector.ID), c.supToken, nil)
		if resp.Status != http.StatusOK {
			t.Fatalf("dashboard: status %d, body %v", resp.Status, resp.Body)
		}
		return cells(resp.Body["numbers"])
	}
	if got := numbers(); got["queued"] != 0 || got["inProgress"] != 1 {
		t.Fatalf("before: %v", got)
	}

	c.markPending("Aguardando ajuste")
	if got := numbers(); got["queued"] != 0 || got["inProgress"] != 0 {
		t.Fatalf("pending counted: %v", got)
	}
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	if got := numbers(); got["queued"] != 1 || got["inProgress"] != 0 {
		t.Fatalf("with a new ticket: %v", got)
	}
	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/dashboard/tickets?sectorId=%d", c.sector.ID), c.supToken, nil)
	queued, _ := resp.Body["queued"].([]any)
	inProgress, _ := resp.Body["inProgress"].([]any)
	if resp.Status != http.StatusOK || len(queued) != 1 || len(inProgress) != 0 ||
		int64(queued[0].(map[string]any)["id"].(float64)) == c.ticket.ID {
		t.Fatalf("dashboard tickets: status %d, body %v", resp.Status, resp.Body)
	}
}
