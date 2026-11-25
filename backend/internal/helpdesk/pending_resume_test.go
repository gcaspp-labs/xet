package helpdesk_test

import (
	"errors"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
)

func (e *testEnv) resume(ticketID int64, token string) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/resume", ticketID), token, nil)
}

// pendingList lists the Pendentes tab of the sector, where the pending tickets
// come from.
func (e *testEnv) pendingList(sectorID int64, token string) []map[string]any {
	e.T.Helper()
	return e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/pending-tickets", sectorID), token)
}

// backdatePending moves the moment the ticket became pending to the past, to
// fix the order of the list without depending on the clock between calls.
func (e *testEnv) backdatePending(ticketID int64, ago time.Duration) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(),
		"update tickets set pending_at = now() - $2::interval where id = $1",
		ticketID, fmt.Sprintf("%d microseconds", ago.Microseconds())); err != nil {
		e.T.Fatal(err)
	}
}

func TestPendingListShowsOnlyPendingOldestFirst(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rh := *e.userSector("rh@exemplo.com")

	c.assign()
	c.markPending("Aguardando ajuste no sistema de folha")
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.assign(second.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.markPending(second.ID, c.biaToken, "Cliente vai confirmar o protocolo antigo"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	third := e.queuedTicket(c.sector.ID, "MSG-3", "5511966665555")
	if resp := e.assign(third.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.markPending(third.ID, c.anaToken, "Aguardando a nota fiscal"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	other := e.queuedTicket(rh, "MSG-4", "5511955554444")
	if resp := e.assign(other.ID, c.rhToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.markPending(other.ID, c.rhToken, "Aguardando laudo"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	e.backdatePending(third.ID, 2*time.Hour)
	e.backdatePending(c.ticket.ID, time.Hour)

	// Atendente, outro atendente e supervisor veem só o próprio setor, na
	// ordem dos mais antigos pendentes primeiro.
	want := []int64{third.ID, c.ticket.ID, second.ID}
	for name, token := range map[string]string{"agent": c.anaToken, "another agent": c.biaToken, "supervisor": c.supToken} {
		list := e.pendingList(c.sector.ID, token)
		if len(list) != 3 {
			t.Fatalf("%s: pending = %v, want 3", name, list)
		}
		for i, row := range list {
			if int64(row["id"].(float64)) != want[i] {
				t.Fatalf("%s: order = %v, want %v", name, list, want)
			}
		}
		if name != "agent" {
			continue
		}
		row := list[0]
		contact, _ := row["contact"].(map[string]any)
		markedBy, _ := row["pendingBy"].(map[string]any)
		sector, _ := row["sector"].(map[string]any)
		if row["protocol"] != third.Protocol ||
			row["reason"] != "Aguardando a nota fiscal" || row["organizationName"] != nil || row["pendingAt"] == nil ||
			contact["name"] != "5511966665555" || contact["phone"] != "5511966665555" || contact["registered"] != false ||
			markedBy["name"] != "ana@exemplo.com" || sector["id"] != float64(c.sector.ID) || sector["name"] != c.sector.Name {
			t.Fatalf("pending row = %v", row)
		}
	}

	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/pending-tickets", c.sector.ID), c.rhToken, nil); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of another sector: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/pending-tickets", c.sector.ID), "", nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}

	// O administrador vê os pendentes de cada setor ativo, com o setor na linha.
	for sectorID, count := range map[int64]int{c.sector.ID: 3, rh: 1} {
		list := e.pendingList(sectorID, c.adminToken)
		if len(list) != count {
			t.Fatalf("admin, sector %d: pending = %v, want %d", sectorID, list, count)
		}
		for _, row := range list {
			if row["sector"].(map[string]any)["id"] != float64(sectorID) {
				t.Fatalf("admin, sector %d: row %v", sectorID, row)
			}
		}
	}
}

func TestResumeFromTheListAssignsWhoResumed(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	bia := e.userID("bia@exemplo.com")
	c.assign()
	before := e.assignment(c.ticket.ID)
	c.markPending("Aguardando ajuste no sistema de folha")
	marked := e.pendingState(c.ticket.ID)

	events := e.subscribe(c.biaToken)
	resp := e.resume(c.ticket.ID, c.biaToken)
	if resp.Status != http.StatusOK || resp.Body["status"] != "in_progress" || resp.Body["assigneeId"] != float64(bia) {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}
	// O setor é avisado depois do commit.
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	// Em atendimento com quem retomou; o horário da primeira vez assumido e os
	// campos do pendente não mudam.
	got := e.pendingState(c.ticket.ID)
	if got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != bia ||
		!got.AssignedAt.Equal(*before.AssignedAt) || got.Reason == nil || *got.Reason != "Aguardando ajuste no sistema de folha" ||
		got.ByID == nil || *got.ByID != c.ana.ID || !got.At.Equal(*marked.At) {
		t.Fatalf("resumed ticket = %+v (before %+v, marked %+v)", got, before, marked)
	}

	// Sai de Pendentes e entra em Meus chamados de quem retomou.
	if list := e.pendingList(c.sector.ID, c.biaToken); len(list) != 0 {
		t.Fatalf("pending after resume = %v", list)
	}
	panel := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.biaToken)
	if len(panel) != 1 || panel[0]["id"] != float64(c.ticket.ID) || panel[0]["status"] != "in_progress" {
		t.Fatalf("panel = %v", panel)
	}
	if assignee, _ := panel[0]["assignee"].(map[string]any); assignee["id"] != float64(bia) {
		t.Fatalf("panel assignee = %v", panel[0]["assignee"])
	}

	// Auditoria de retomada, com quem retomou.
	actions, changes := e.AuditChanges("ticket", c.ticket.ID)
	if len(actions) != 3 || actions[0] != "ticket_assigned" || actions[1] != "ticket_pending" || actions[2] != "ticket_resumed" {
		t.Fatalf("audit = %v", actions)
	}
	if changes[2]["status"]["from"] != "pending" || changes[2]["status"]["to"] != "in_progress" ||
		changes[2]["assignee_id"]["from"] != nil || changes[2]["assignee_id"]["to"] != float64(bia) {
		t.Fatalf("audit changes = %v", changes[2])
	}
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "ticket", EntityID: c.ticket.ID})
	if err != nil {
		t.Fatal(err)
	}
	if last := logs[len(logs)-1]; last.ActorID == nil || *last.ActorID != bia {
		t.Fatalf("audit actor = %v, want %d", last.ActorID, bia)
	}

	// Clique repetido de quem já retomou não muda nada.
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK || resp.Body["assigneeId"] != float64(bia) {
		t.Fatalf("resume again: status %d, body %v", resp.Status, resp.Body)
	}
	if again := e.pendingState(c.ticket.ID); !again.At.Equal(*marked.At) {
		t.Fatalf("repeated click changed the pending fields: %+v", again)
	}
	if actions, _ := e.AuditChanges("ticket", c.ticket.ID); len(actions) != 3 {
		t.Fatalf("audit after the repeated click = %v", actions)
	}
}

func TestResumePermissionsAndRefusals(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	sup := e.userID("sup@exemplo.com")
	admin := e.userID("admin@exemplo.com")
	c.assign()
	c.markPending("Aguardando ajuste")

	if resp := e.resume(c.ticket.ID, ""); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	if resp := e.resume(c.ticket.ID, c.rhToken); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of another sector: status %d", resp.Status)
	}
	if resp := e.resume(999999, c.anaToken); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown ticket: status %d", resp.Status)
	}

	// Na fila não é pendente: assume-se pelo botão da Fila.
	queued := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.resume(queued.ID, c.anaToken); resp.Status != http.StatusConflict || resp.Body["error"] != "Este chamado não está pendente." {
		t.Fatalf("queued ticket: status %d, body %v", resp.Status, resp.Body)
	}

	// Outro atendente do setor, não quem marcou, retoma; para quem marcou deixa
	// de valer, porque o chamado agora é de outra pessoa.
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("another agent: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.resume(c.ticket.ID, c.anaToken); resp.Status != http.StatusConflict || resp.Body["error"] != "Este chamado já foi assumido por outro atendente." {
		t.Fatalf("who marked: status %d, body %v", resp.Status, resp.Body)
	}

	e.closeTicket(c.ticket.ID, e.userID("bia@exemplo.com"), org)
	if resp := e.resume(c.ticket.ID, c.anaToken); resp.Status != http.StatusConflict || resp.Body["error"] != "Este chamado já foi encerrado." {
		t.Fatalf("closed ticket: status %d, body %v", resp.Status, resp.Body)
	}

	// O supervisor do setor e o administrador retomam como qualquer atendente.
	for _, tc := range []struct {
		name     string
		token    string
		assignee int64
	}{{"supervisor", c.supToken, sup}, {"admin", c.adminToken, admin}} {
		tk := e.queuedTicket(c.sector.ID, "MSG-"+tc.name, fmt.Sprintf("55119444%05d", tc.assignee))
		if resp := e.assign(tk.ID, c.anaToken); resp.Status != http.StatusOK {
			t.Fatalf("%s: assign status %d", tc.name, resp.Status)
		}
		if resp := e.markPending(tk.ID, c.anaToken, "Aguardando "+tc.name); resp.Status != http.StatusOK {
			t.Fatalf("%s: mark pending status %d", tc.name, resp.Status)
		}
		if resp := e.resume(tk.ID, tc.token); resp.Status != http.StatusOK || resp.Body["assigneeId"] != float64(tc.assignee) {
			t.Fatalf("%s: resume status %d, body %v", tc.name, resp.Status, resp.Body)
		}
	}
}

func TestResumeRefusedWhileTheContactHasAnOpenTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	ana := e.userID("ana@exemplo.com")
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	c.assign()
	c.markPending("Aguardando ajuste")
	audits := func(ticketID int64) int {
		var n int
		if err := e.Pool.QueryRow(t.Context(), "select count(*) from audit_logs where ticket_id = $1", ticketID).Scan(&n); err != nil {
			t.Fatal(err)
		}
		return n
	}
	before, n := e.pendingState(c.ticket.ID), audits(c.ticket.ID)

	// O cliente volta a escrever: abre um chamado na fila.
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	tickets := e.tickets(c.sector.ID)
	if len(tickets) != 2 || tickets[1].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	queued := tickets[1]

	resp := e.resume(c.ticket.ID, c.biaToken)
	want := "Este contato tem o chamado " + queued.Protocol + " na fila. Encerre esse chamado ou use Retomar chamado a partir dele."
	if resp.Status != http.StatusConflict || resp.Body["error"] != want {
		t.Fatalf("resume with a queued ticket: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.pendingState(c.ticket.ID); got.Status != "pending" || !got.At.Equal(*before.At) || audits(c.ticket.ID) != n {
		t.Fatalf("refused resume changed the ticket: %+v (before %+v)", got, before)
	}

	// Em atendimento com outra pessoa: o aviso traz o protocolo e o responsável.
	if resp := e.assign(queued.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	resp = e.resume(c.ticket.ID, c.biaToken)
	want = "Este contato tem o chamado " + queued.Protocol + " aberto com ana@exemplo.com. Encerre esse chamado ou use Retomar chamado a partir dele."
	if resp.Status != http.StatusConflict || resp.Body["error"] != want {
		t.Fatalf("resume with a ticket in progress: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.pendingState(c.ticket.ID); got.Status != "pending" || audits(c.ticket.ID) != n {
		t.Fatalf("refused resume changed the ticket: %+v", got)
	}

	// Encerrado o outro, a retomada vale.
	e.closeTicket(queued.ID, ana, org)
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume after the other was closed: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestOnlyOneAgentResumesConcurrently(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste")

	const agents = 10
	tokens := make([]string, agents)
	ids := make(map[string]int64, agents)
	for i := range tokens {
		email := fmt.Sprintf("retoma%d@exemplo.com", i)
		u := e.User(email, db.UserRoleAgent, &c.sector.ID)
		tokens[i] = e.Login(email, testPassword)
		ids[tokens[i]] = u.ID
	}

	responses := make([]response, agents)
	var wg sync.WaitGroup
	start := make(chan struct{})
	for i, token := range tokens {
		wg.Go(func() {
			<-start
			responses[i] = e.resume(c.ticket.ID, token)
		})
	}
	close(start)
	wg.Wait()

	var winner int64
	for i, resp := range responses {
		switch resp.Status {
		case http.StatusOK:
			if winner != 0 {
				t.Fatalf("two agents resumed the ticket: responses %v", responses)
			}
			winner = ids[tokens[i]]
		case http.StatusConflict:
			// Quem perdeu recebe o aviso de que outro assumiu, não só o 409.
			if resp.Body["error"] != "Este chamado já foi assumido por outro atendente." {
				t.Fatalf("agent %d: conflict with %v", i, resp.Body)
			}
		default:
			t.Fatalf("agent %d: status %d, body %v", i, resp.Status, resp.Body)
		}
	}
	if winner == 0 {
		t.Fatalf("no agent resumed the ticket: responses %v", responses)
	}
	got := e.pendingState(c.ticket.ID)
	if got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != winner {
		t.Fatalf("ticket after resume = %+v, want in_progress by %d", got, winner)
	}
	actions, _ := e.AuditChanges("ticket", c.ticket.ID)
	if len(actions) != 3 || actions[2] != "ticket_resumed" {
		t.Fatalf("audit = %v, want one ticket_resumed", actions)
	}
}

// Uma mensagem do cliente bem na hora em que alguém retoma cai num único
// chamado na fila ou em atendimento: ou a retomada vence e ele entra no
// chamado retomado, ou a mensagem abre um chamado antes e a retomada é
// recusada com o protocolo dele. Nunca duplica nem perde mensagem.
func TestConcurrentMessagesAndResume(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			bia := e.userID("bia@exemplo.com")
			c.assign()
			c.markPending("Aguardando ajuste")

			var wg sync.WaitGroup
			var resumed response
			errs := make(chan error, 3)
			wg.Go(func() { resumed = e.resume(c.ticket.ID, c.biaToken) })
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

			tickets := e.tickets(c.sector.ID)
			open := 0
			seen := map[string]int64{}
			for _, tk := range tickets {
				if tk.Status == "queued" || tk.Status == "in_progress" {
					open++
				}
				for _, m := range e.messages(tk.ID) {
					if _, dup := seen[*m.ExternalMessageID]; dup {
						t.Fatalf("message %s recorded twice", *m.ExternalMessageID)
					}
					seen[*m.ExternalMessageID] = tk.ID
				}
			}
			if open != 1 || len(seen) != 3 {
				t.Fatalf("tickets = %+v, messages = %v", tickets, seen)
			}
			switch resumed.Status {
			case http.StatusOK:
				if got := e.pendingState(c.ticket.ID); got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != bia {
					t.Fatalf("resumed ticket = %+v", got)
				}
			case http.StatusConflict:
				if !strings.Contains(fmt.Sprint(resumed.Body["error"]), "Este contato tem o chamado") {
					t.Fatalf("resume refused with %v, want the notice of the open ticket", resumed.Body)
				}
			default:
				t.Fatalf("resume: status %d, body %v", resumed.Status, resumed.Body)
			}
		})
	}
}

// Uma retomada recusada pelo índice único consulta o chamado vencedor. Se ele
// foi encerrado antes dessa nova consulta — raro —, a resposta é o aviso de
// tentar novamente, não um erro 500.
func TestResumeNoticeWhenTheWinningTicketIsGone(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	c.assign()
	c.markPending("Aguardando ajuste")

	// A mensagem do mesmo contato abre um chamado na fila, o que venceria a
	// retomada.
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	var queued ticketRow
	for _, tk := range e.tickets(c.sector.ID) {
		if tk.ContactID == c.ticket.ContactID && tk.Status == "queued" {
			queued = tk
		}
	}
	if queued.ID == 0 {
		t.Fatal("no queued ticket for the contact")
	}

	// Com o vencedor aberto, o aviso nomeia o protocolo dele.
	err := helpdesk.OpenTicketOfContact(e.TicketService, t.Context(), c.ticket.ID)
	var open *helpdesk.OpenTicketError
	if !errors.As(err, &open) || open.Protocol != queued.Protocol {
		t.Fatalf("open ticket of the contact = %v, want %s", err, queued.Protocol)
	}

	// Encerrado antes da nova consulta, não há chamado aberto para nomear: a
	// retomada pede para tentar de novo.
	e.closeTicket(queued.ID, c.ana.ID, org)
	if err := helpdesk.OpenTicketOfContact(e.TicketService, t.Context(), c.ticket.ID); !errors.Is(err, helpdesk.ErrResumeRaced) {
		t.Fatalf("open ticket of the contact after the closing = %v, want ErrResumeRaced", err)
	}

	// Fora do caminho o vencedor encerrado, a retomada pela API funciona.
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume after the winning ticket closed: status %d, body %v", resp.Status, resp.Body)
	}
}

// Depois de retomar, a mensagem do cliente entra no chamado retomado.
func TestMessageAfterResumeEntersTheResumedTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste")
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
	tickets := e.tickets(c.sector.ID)
	if len(tickets) != 1 || tickets[0].Status != "in_progress" {
		t.Fatalf("tickets = %+v", tickets)
	}
	if msgs := e.messages(c.ticket.ID); len(msgs) != 2 {
		t.Fatalf("messages = %+v", msgs)
	}
}

func TestAfterResumeTheNewAssigneeActsOnTheMessages(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	sent := e.sendText(c.ticket.ID, c.anaToken, requestA, "Segue o boleto")
	if sent.Status != http.StatusOK {
		t.Fatalf("send: status %d", sent.Status)
	}
	sentID := int64(sent.Body["id"].(float64))
	customer := e.messageID(c.ticket.ID, "MSG-1")
	c.markPending("Aguardando ajuste")
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}

	// Quem retomou envia, edita, exclui e reage.
	reply := e.sendText(c.ticket.ID, c.biaToken, requestB, "Assumi o atendimento")
	if reply.Status != http.StatusOK {
		t.Fatalf("send: status %d, body %v", reply.Status, reply.Body)
	}
	replyID := int64(reply.Body["id"].(float64))
	if resp := e.editMessage(sentID, c.biaToken, requestE1, "Segue o boleto de setembro"); resp.Status != http.StatusOK {
		t.Fatalf("edit: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.reactTo(customer, c.biaToken, "👍"); resp.Status != http.StatusOK {
		t.Fatalf("react: status %d, body %v", resp.Status, resp.Body)
	}

	// Quem marcou, se não for ele, é recusado.
	for name, try := range map[string]func(string) response{
		"send":   func(token string) response { return e.sendText(c.ticket.ID, token, requestE2, "Ainda estou aqui") },
		"edit":   func(token string) response { return e.editMessage(replyID, token, requestE3, "Editado") },
		"delete": func(token string) response { return e.deleteMessage(replyID, token, requestE4, "everyone") },
		"react":  func(token string) response { return e.reactTo(customer, token, "❤️") },
	} {
		if resp := try(c.anaToken); resp.Status != http.StatusForbidden {
			t.Errorf("who marked, %s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}

	if resp := e.deleteMessage(sentID, c.biaToken, requestE5, "everyone"); resp.Status != http.StatusOK {
		t.Fatalf("delete: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestResumeLinksTheOrganizationRegisteredWhilePending(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	c.assign()
	c.markPending("Aguardando ajuste")

	// Cadastro do contato enquanto o chamado está pendente: o setor é avisado,
	// e o pendente continua sem órgão, que chega na retomada.
	events := e.subscribe(c.biaToken)
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken, map[string]any{
		"name": "Maria Oliveira", "phone": "5511988887777", "organizationId": org, "sectorIds": []int64{c.sector.ID},
	})
	if resp.Status != http.StatusOK {
		t.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	ticket := e.tickets(c.sector.ID)[0]
	if ticket.Status != "pending" || ticket.OrganizationID != nil {
		t.Fatalf("pending ticket after the registration = %+v", ticket)
	}
	if actions, _ := e.AuditChanges("ticket", c.ticket.ID); len(actions) != 2 {
		t.Fatalf("audit after the registration = %v", actions)
	}
	// A lista Pendentes já traz o nome e o órgão novos do contato.
	row := e.pendingList(c.sector.ID, c.biaToken)[0]
	if row["organizationName"] != "Prefeitura de Campinas" || row["contact"].(map[string]any)["name"] != "Maria Oliveira" {
		t.Fatalf("pending row = %v", row)
	}

	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}
	var linked *int64
	if err := e.Pool.QueryRow(t.Context(), "select organization_id from tickets where id = $1", c.ticket.ID).Scan(&linked); err != nil {
		t.Fatal(err)
	}
	if linked == nil || *linked != org {
		t.Fatalf("organization after resume = %v, want %d", linked, org)
	}
	actions, changes := e.AuditChanges("ticket", c.ticket.ID)
	if len(actions) != 4 || actions[2] != "ticket_resumed" || actions[3] != "ticket_organization_linked" {
		t.Fatalf("audit after resume = %v", actions)
	}
	if changes[3]["organization_id"]["from"] != nil || changes[3]["organization_id"]["to"] != float64(org) {
		t.Fatalf("audit changes = %v", changes[3])
	}

	// Um chamado que já tinha órgão não muda de órgão ao retomar.
	e.Contact(c.anaToken, "João Souza", "5511944443333", org, c.sector.ID)
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511944443333")
	if second.OrganizationID == nil || *second.OrganizationID != org {
		t.Fatalf("new ticket organization = %v", second.OrganizationID)
	}
	if resp := e.assign(second.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.markPending(second.ID, c.anaToken, "Aguardando a nota fiscal"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d", resp.Status)
	}
	if resp := e.resume(second.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}
	var kept *int64
	if err := e.Pool.QueryRow(t.Context(), "select organization_id from tickets where id = $1", second.ID).Scan(&kept); err != nil {
		t.Fatal(err)
	}
	if kept == nil || *kept != org {
		t.Fatalf("organization of the ticket that already had one = %v", kept)
	}
	if actions, _ := e.AuditChanges("ticket", second.ID); len(actions) != 3 || actions[2] != "ticket_resumed" {
		t.Fatalf("audit of the ticket that already had an organization = %v", actions)
	}
}

// Salvar só o nome de um contato não cadastrado também avisa o chamado
// pendente, que mostra o nome novo na lista.
func TestContactNameSavesAnnounceThePendingTicket(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste")

	events := e.subscribe(c.biaToken)
	if resp := e.saveContactName(c.ticket.ContactID, c.anaToken, "Maria Souza"); resp.Status != http.StatusOK {
		t.Fatalf("save name: status %d, body %v", resp.Status, resp.Body)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	row := e.pendingList(c.sector.ID, c.biaToken)[0]
	if row["contact"].(map[string]any)["name"] != "Maria Souza" {
		t.Fatalf("pending row = %v", row)
	}
}

// A conversa mostra quando o chamado ficou pendente e quando foi retomado, na
// ordem do tempo, junto das transferências.
func TestAssignmentsShowPendingAndResume(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste no sistema de folha")
	if resp := e.resume(c.ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}

	list := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.biaToken)
	if len(list) != 3 || list[0]["action"] != "ticket_assigned" || list[1]["action"] != "ticket_pending" || list[2]["action"] != "ticket_resumed" {
		t.Fatalf("assignments = %v", list)
	}
	if list[1]["reason"] != "Aguardando ajuste no sistema de folha" ||
		list[1]["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("pending assignment = %v", list[1])
	}
	if list[2]["actor"].(map[string]any)["name"] != "bia@exemplo.com" {
		t.Fatalf("resume assignment = %v", list[2])
	}
}
