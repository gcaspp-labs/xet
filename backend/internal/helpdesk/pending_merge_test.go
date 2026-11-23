package helpdesk_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
)

func (e *testEnv) resumePending(ticketID int64, token string, pendingID int64) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/resume-pending", ticketID), token,
		map[string]any{"pendingTicketId": pendingID})
}

// mergedState is what a merged ticket keeps, with the number of modules.
type mergedState struct {
	Status      string
	ClosureType *string
	MergedInto  *int64
	Subject     *string
	Resolution  *string
	ClosedByID  *int64
	ClosedAt    *time.Time
	EndedAt     *time.Time
	Modules     int
}

func (e *testEnv) mergedState(ticketID int64) mergedState {
	e.T.Helper()
	var s mergedState
	if err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, closure_type::text, merged_into_ticket_id, subject, resolution,
		       closed_by_id, closed_at, ended_at,
		       (select count(*) from ticket_modules where ticket_id = $1)
		from tickets where id = $1`, ticketID).
		Scan(&s.Status, &s.ClosureType, &s.MergedInto, &s.Subject, &s.Resolution,
			&s.ClosedByID, &s.ClosedAt, &s.EndedAt, &s.Modules); err != nil {
		e.T.Fatal(err)
	}
	return s
}

// detailAs asks for the ticket as the screen does.
func (e *testEnv) detailAs(ticketID int64, token string) map[string]any {
	e.T.Helper()
	status, _, raw := e.get(fmt.Sprintf("/api/tickets/%d", ticketID), token)
	if status != http.StatusOK {
		e.T.Fatalf("ticket %d: status %d", ticketID, status)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		e.T.Fatal(err)
	}
	return out
}

// queuedTicketOf returns the only queued ticket of the contact in the sector.
func (e *testEnv) queuedTicketOf(sectorID, contactID int64) ticketRow {
	e.T.Helper()
	var found []ticketRow
	for _, tk := range e.tickets(sectorID) {
		if tk.ContactID == contactID && tk.Status == "queued" {
			found = append(found, tk)
		}
	}
	if len(found) != 1 {
		e.T.Fatalf("queued tickets of the contact = %+v", found)
	}
	return found[0]
}

// pendingOf marks a new ticket of another contact in the sector as pending.
func (e *testEnv) pendingOf(sectorID int64, msgID, phone, token, reason string) ticketRow {
	e.T.Helper()
	tk := e.queuedTicket(sectorID, msgID, phone)
	if resp := e.assign(tk.ID, token); resp.Status != http.StatusOK {
		e.T.Fatalf("assign %s: status %d", msgID, resp.Status)
	}
	if resp := e.markPending(tk.ID, token, reason); resp.Status != http.StatusOK {
		e.T.Fatalf("mark pending %s: status %d, body %v", msgID, resp.Status, resp.Body)
	}
	return tk
}

// pendingThenNewTicket prepares the pending A of the conversation's contact
// and the new ticket B in progress of the same contact, and returns B.
func (c conversation) pendingThenNewTicket() ticketRow {
	c.e.T.Helper()
	c.assign()
	c.markPending("Aguardando ajuste no sistema de folha")
	c.e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei, o problema continua"))
	b := c.e.queuedTicketOf(c.sector.ID, c.ticket.ContactID)
	if resp := c.e.assign(b.ID, c.anaToken); resp.Status != http.StatusOK {
		c.e.T.Fatalf("assign B: status %d", resp.Status)
	}
	return b
}

func TestTicketInProgressShowsPendingsOfTheContact(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	b := c.pendingThenNewTicket()
	a := c.ticket // o pendente do mesmo contato e setor

	same := e.pendingOf(c.sector.ID, "MSG-9", "5511900000001", c.anaToken, "Aguardando nota fiscal")
	rh := *e.userSector("rh@exemplo.com")
	other := e.pendingOf(rh, "MSG-10", "5511900000002", c.rhToken, "Aguardando laudo")

	detail := e.detailAs(b.ID, c.anaToken)
	pending, ok := detail["pendingTickets"].([]any)
	if !ok || len(pending) != 1 {
		t.Fatalf("pendingTickets = %v, want only the same contact and sector", detail["pendingTickets"])
	}
	choice := pending[0].(map[string]any)
	by := choice["by"].(map[string]any)
	if int64(choice["id"].(float64)) != a.ID || choice["protocol"] != a.Protocol ||
		choice["reason"] != "Aguardando ajuste no sistema de folha" || by["name"] != "ana@exemplo.com" || choice["at"] == nil {
		t.Fatalf("pending choice = %v", choice)
	}
	for _, id := range []int64{same.ID, other.ID} {
		for _, p := range pending {
			if int64(p.(map[string]any)["id"].(float64)) == id {
				t.Fatalf("pending of another contact or sector in the detail: %v", p)
			}
		}
	}

	// Fora do atendimento, o detalhe não traz a lista.
	if got := e.detailAs(c.ticket.ID, c.supToken)["pendingTickets"]; got != nil {
		t.Fatalf("pending ticket detail brought pendingTickets: %v", got)
	}
	clean := newConversation(t)
	clean.assign()
	if got := clean.e.detailAs(clean.ticket.ID, clean.anaToken)["pendingTickets"]; got != nil {
		t.Fatalf("ticket without pendings brought pendingTickets: %v", got)
	}
}

func TestResumePendingMergesTheNewTicketIntoThePending(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	b := c.pendingThenNewTicket()
	a := c.ticket // o pendente do mesmo contato e setor
	ana := e.userID("ana@exemplo.com")
	assignedAt := e.assignment(a.ID).AssignedAt

	// B tem mensagem recebida, enviada com anexo, uma edição e uma exclusão do
	// cliente, uma reação do cliente e uma edição pedida pelo responsável.
	if resp := e.sendText(b.ID, c.anaToken, requestA, "Vou verificar com o desenvolvimento"); resp.Status != http.StatusOK {
		t.Fatalf("send: status %d, body %v", resp.Status, resp.Body)
	}
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 32)...)
	if resp := e.sendFile(b.ID, c.anaToken, requestB, "print.png", "image/png", png, "Segue o print"); resp.Status != http.StatusOK {
		t.Fatalf("send file: status %d, body %v", resp.Status, resp.Body)
	}
	e.receive(c.sector.ID, text("MSG-3", "5511988887777@s.whatsapp.net", "5511988887777", "Outra mensagem"))
	e.edit(c.sector.ID, "EV-EDIT-1", "MSG-2", "Voltei, o problema continua (editado)", time.Now())
	e.revoke(c.sector.ID, "EV-REVOKE-1", "MSG-3", false, time.Now())
	e.react(c.sector.ID, "MSG-2", "👍", time.Now())

	agentMessage := e.outbound(b.ID)[0]
	if resp := e.editMessage(agentMessage.ID, c.anaToken, "1b2c3d4e-1d0a-4f5b-9c1e-0a1b2c3d4e5f", "Vou verificar com o desenvolvimento (revisto)"); resp.Status != http.StatusOK {
		t.Fatalf("edit before merge: status %d, body %v", resp.Status, resp.Body)
	}

	before := e.messages(b.ID)
	if len(before) != 4 {
		t.Fatalf("messages of B = %+v, want 4", before)
	}
	times := make(map[string]time.Time, len(before))
	for _, m := range before {
		times[*m.ExternalMessageID] = m.SentAt
	}

	events := e.subscribe(c.biaToken)
	resp := e.resumePending(b.ID, c.anaToken, a.ID)
	if resp.Status != http.StatusOK || int64(resp.Body["id"].(float64)) != a.ID ||
		resp.Body["protocol"] != a.Protocol || resp.Body["status"] != "in_progress" ||
		resp.Body["assigneeId"] != float64(ana) {
		t.Fatalf("resume pending: status %d, body %v", resp.Status, resp.Body)
	}
	// A e B avisam o setor depois do commit.
	for _, want := range []realtime.Event{realtime.TicketChanged(c.sector.ID, a.ID), realtime.TicketChanged(c.sector.ID, b.ID)} {
		if ev := e.nextEvent(events); ev != want {
			t.Fatalf("event = %+v, want %+v", ev, want)
		}
	}

	// B fica mesclado em A, com os dados de encerramento e sem assunto,
	// resolução nem módulos.
	merged := e.mergedState(b.ID)
	if merged.Status != "closed" || merged.ClosureType == nil || *merged.ClosureType != "merged" ||
		merged.MergedInto == nil || *merged.MergedInto != a.ID ||
		merged.ClosedByID == nil || *merged.ClosedByID != ana ||
		merged.ClosedAt == nil || merged.EndedAt == nil || merged.Subject != nil || merged.Resolution != nil || merged.Modules != 0 {
		t.Fatalf("merged ticket = %+v", merged)
	}
	// A volta ao atendimento com quem mesclou, e assigned_at não muda.
	resumed := e.pendingState(a.ID)
	if resumed.Status != "in_progress" || resumed.AssigneeID == nil || *resumed.AssigneeID != ana {
		t.Fatalf("resumed ticket = %+v", resumed)
	}
	if resumed.AssignedAt == nil || assignedAt == nil || !resumed.AssignedAt.Equal(*assignedAt) {
		t.Fatalf("assigned_at = %v, want %v", resumed.AssignedAt, assignedAt)
	}

	// As mensagens de B passaram para A, com horários, anexos, versões e
	// exclusão preservados, e B não tem mais nenhuma.
	if got := e.messages(b.ID); len(got) != 0 {
		t.Fatalf("messages of the merged ticket = %+v", got)
	}
	moved := e.messages(a.ID)
	byExternal := make(map[string]messageRow, len(moved))
	for _, m := range moved {
		byExternal[*m.ExternalMessageID] = m
	}
	for _, old := range before {
		m, ok := byExternal[*old.ExternalMessageID]
		if !ok {
			t.Fatalf("message %s did not move to A", *old.ExternalMessageID)
		}
		sameMedia := (m.MediaID == nil) == (old.MediaID == nil) && (m.MediaID == nil || *m.MediaID == *old.MediaID)
		if !m.SentAt.Equal(times[*old.ExternalMessageID]) || m.ID != old.ID ||
			!sameMedia || str(m.Body) != str(old.Body) {
			t.Fatalf("message %s changed in the merge: before %+v, after %+v", *old.ExternalMessageID, old, m)
		}
	}
	// A conversa de A mostra as mensagens de B na ordem do tempo.
	if len(moved) != 5 || *moved[len(moved)-1].ExternalMessageID != "MSG-3" {
		t.Fatalf("conversation of A = %+v", moved)
	}
	// A exclusão do cliente e as versões continuam valendo na mensagem movida.
	var deleted *time.Time
	var scope *string
	if err := e.Pool.QueryRow(t.Context(), `
		select deleted_at, deletion_scope::text from messages where ticket_id = $1 and external_message_id = 'MSG-3'`, a.ID).
		Scan(&deleted, &scope); err != nil {
		t.Fatal(err)
	}
	if deleted == nil || scope == nil || *scope != "everyone" {
		t.Fatalf("deletion of the moved message = %v (%v)", deleted, scope)
	}
	var versions int
	if err := e.Pool.QueryRow(t.Context(), `
		select count(*) from message_changes c join messages m on m.id = c.message_id
		where m.ticket_id = $1 and m.external_message_id = 'MSG-2'`, a.ID).Scan(&versions); err != nil {
		t.Fatal(err)
	}
	if versions < 2 {
		t.Fatalf("versions of the edited message = %d, want the original and the edit", versions)
	}
	// A ação de edição pedida antes da mesclagem acompanhou a mensagem.
	var actionTicket int64
	if err := e.Pool.QueryRow(t.Context(), "select ticket_id from message_actions where message_id = $1", agentMessage.ID).Scan(&actionTicket); err != nil {
		t.Fatal(err)
	}
	if actionTicket != a.ID {
		t.Fatalf("message action of ticket %d, want %d", actionTicket, a.ID)
	}

	// Depois da mesclagem, o responsável edita, exclui e reage nas mensagens
	// que vieram de B.
	if resp := e.editMessage(agentMessage.ID, c.anaToken, "2c3d4e5f-2e1b-4a6c-8d2f-1b2c3d4e5f60", "Verifiquei, vou corrigir"); resp.Status != http.StatusOK {
		t.Fatalf("edit after merge: status %d, body %v", resp.Status, resp.Body)
	}
	var imageID int64
	for _, m := range e.messages(a.ID) {
		if m.Type == "image" && m.ExternalMessageID != nil {
			imageID = m.ID
		}
	}
	if imageID == 0 {
		t.Fatalf("image from B not in A: %+v", e.messages(a.ID))
	}
	if resp := e.deleteMessage(imageID, c.anaToken, "3d4e5f60-3f1c-4b7d-9e30-2c3d4e5f6071", "everyone"); resp.Status != http.StatusOK {
		t.Fatalf("delete after merge: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.reactTo(agentMessage.ID, c.anaToken, "✅"); resp.Status != http.StatusOK {
		t.Fatalf("react after merge: status %d, body %v", resp.Status, resp.Body)
	}
	// A edição e a reação do cliente sobre as mensagens vindas de B atualizam
	// a mensagem em A.
	e.edit(c.sector.ID, "EV-EDIT-2", "MSG-2", "Continua sim", time.Now().Add(time.Minute))
	e.react(c.sector.ID, "MSG-2", "❤️", time.Now().Add(time.Minute))
	msg := e.apiMessage(a.ID, c.anaToken, "MSG-2")
	if msg["body"] != "Continua sim" {
		t.Fatalf("message after the client edit = %v", msg["body"])
	}
	reactions := msg["reactions"].(map[string]any)
	if customer, _ := reactions["customer"].(map[string]any); customer == nil || customer["emoji"] != "❤️" {
		t.Fatalf("reactions after the client reaction = %v", reactions)
	}

	// Auditoria nos dois: B sabe em que chamado foi mesclado e quais
	// mensagens passaram; A sabe de qual chamado foi retomado.
	actions, changes := e.AuditChanges("ticket", b.ID)
	last := changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_merged" || last["merged_into_ticket_id"]["to"] != float64(a.ID) ||
		len(last["message_ids"]["to"].([]any)) != 4 || last["closure_type"]["to"] != "merged" {
		t.Fatalf("audit of B = %v %v", actions[len(actions)-1], last)
	}
	actions, changes = e.AuditChanges("ticket", a.ID)
	last = changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_resumed_by_merge" || last["merged_ticket_id"]["to"] != float64(b.ID) ||
		last["merged_protocol"]["to"] != b.Protocol || last["assignee_id"]["to"] != float64(ana) {
		t.Fatalf("audit of A = %v %v", actions[len(actions)-1], last)
	}

	// A conversa de A tem o aviso da mesclagem, com o protocolo de B, para a
	// tela (#338).
	assignments := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", a.ID), c.biaToken)
	found := false
	for _, entry := range assignments {
		if entry["action"] == "ticket_resumed_by_merge" {
			found = true
			if entry["mergedProtocol"] != b.Protocol || entry["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
				t.Fatalf("merge notice = %v", entry)
			}
		}
	}
	if !found {
		t.Fatalf("no merge notice in the conversation: %v", assignments)
	}

	// Atendimentos traz B como Mesclado, com o chamado de destino, e o
	// detalhe de B também.
	rows := e.DoPageItems(fmt.Sprintf("/api/closed-tickets?sectorId=%d", c.sector.ID), c.anaToken)
	var listRow map[string]any
	for _, row := range rows {
		if int64(row["id"].(float64)) == b.ID {
			listRow = row
		}
	}
	if listRow == nil || listRow["closureType"] != "merged" {
		t.Fatalf("merged ticket in Atendimentos = %v", listRow)
	}
	if into := listRow["mergedInto"].(map[string]any); int64(into["id"].(float64)) != a.ID || into["protocol"] != a.Protocol {
		t.Fatalf("mergedInto in Atendimentos = %v", into)
	}
	detail := e.detailAs(b.ID, c.anaToken)
	if into := detail["mergedInto"].(map[string]any); int64(into["id"].(float64)) != a.ID || into["protocol"] != a.Protocol {
		t.Fatalf("mergedInto in the detail = %v", into)
	}
	// B mesclado não tem correção.
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	resp = e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/correct", b.ID), c.supToken, map[string]any{
		"subject": "Dúvida", "resolution": "Resolvida", "moduleIds": []int64{1}, "organizationId": org,
		"startedAt": time.Now().Add(-time.Hour), "endedAt": time.Now(), "reason": "Ajuste",
	})
	if resp.Status != http.StatusConflict || resp.Body["error"] != "Chamado mesclado num pendente não é corrigido." {
		t.Fatalf("correction of a merged ticket: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestResumePendingRefusals(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	c.markPending("Aguardando ajuste")
	a := c.ticket

	// B na fila é recusado.
	e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei"))
	b := e.queuedTicketOf(c.sector.ID, c.ticket.ContactID)
	if resp := e.resumePending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusConflict ||
		resp.Body["error"] != "Este chamado está na fila. Assuma o chamado antes de retomar um pendente." {
		t.Fatalf("queued B: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.assign(b.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign B: status %d", resp.Status)
	}

	// Só o responsável por B retoma, nem o supervisor nem o administrador.
	for name, token := range map[string]string{"another agent": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken} {
		if resp := e.resumePending(b.ID, token, a.ID); resp.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	// O pendente precisa ser do mesmo contato e setor.
	other := e.pendingOf(c.sector.ID, "MSG-9", "5511900000001", c.anaToken, "Aguardando nota fiscal")
	if resp := e.resumePending(b.ID, c.anaToken, other.ID); resp.Status != http.StatusUnprocessableEntity ||
		resp.Body["error"] != "Escolha um chamado pendente do mesmo contato e setor." {
		t.Fatalf("pending of another contact: status %d, body %v", resp.Status, resp.Body)
	}
	rh := *e.userSector("rh@exemplo.com")
	otherSector := e.pendingOf(rh, "MSG-10", "5511900000002", c.rhToken, "Aguardando laudo")
	if resp := e.resumePending(b.ID, c.anaToken, otherSector.ID); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("pending of another sector: status %d, body %v", resp.Status, resp.Body)
	}
	// Um chamado que não está pendente é recusado.
	if resp := e.resumePending(b.ID, c.anaToken, b.ID); resp.Status != http.StatusConflict ||
		!strings.Contains(fmt.Sprint(resp.Body["error"]), "não está mais pendente") {
		t.Fatalf("ticket that is not pending: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.resumePending(b.ID, c.anaToken, 999999); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown pending: status %d, body %v", resp.Status, resp.Body)
	}

	// Nada mudou em nenhuma recusa.
	if got := e.mergedState(b.ID); got.Status != "in_progress" || got.MergedInto != nil || got.ClosureType != nil {
		t.Fatalf("B after the refusals = %+v", got)
	}
	if got := e.pendingState(a.ID); got.Status != "pending" {
		t.Fatalf("A after the refusals = %+v", got)
	}
	if got := e.pendingState(other.ID); got.Status != "pending" {
		t.Fatalf("pending of the other contact after the refusals = %+v", got)
	}
	if got := e.pendingState(otherSector.ID); got.Status != "pending" {
		t.Fatalf("pending of the other sector after the refusals = %+v", got)
	}
	if n := len(e.messages(b.ID)); n != 1 {
		t.Fatalf("messages of B after the refusals = %d, want 1", n)
	}
	if n := len(e.messages(a.ID)); n != 1 {
		t.Fatalf("messages of A after the refusals = %d, want 1", n)
	}
}

// Dois pedidos de mesclar o mesmo B, cada um num pendente do contato: só um
// vence, e as mensagens ficam num único chamado em atendimento.
func TestOnlyOneMergeWinsConcurrently(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			// Dois pendentes do contato: o primeiro é a conversa, o segundo
			// nasce da mensagem seguinte, depois que ela volta a pendente.
			c.assign()
			c.markPending("Aguardando ajuste")
			first := c.ticket
			e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Outro assunto"))
			second := e.queuedTicketOf(c.sector.ID, c.ticket.ContactID)
			if resp := e.assign(second.ID, c.biaToken); resp.Status != http.StatusOK {
				t.Fatalf("assign second: status %d", resp.Status)
			}
			if resp := e.markPending(second.ID, c.biaToken, "Aguardando nota fiscal"); resp.Status != http.StatusOK {
				t.Fatalf("mark second pending: status %d", resp.Status)
			}
			e.receive(c.sector.ID, text("MSG-3", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei, o problema continua"))
			b := e.queuedTicketOf(c.sector.ID, c.ticket.ContactID)
			if resp := e.assign(b.ID, c.anaToken); resp.Status != http.StatusOK {
				t.Fatalf("assign B: status %d", resp.Status)
			}

			responses := make([]response, 2)
			var wg sync.WaitGroup
			start := make(chan struct{})
			for i, target := range []int64{first.ID, second.ID} {
				wg.Go(func() {
					<-start
					responses[i] = e.resumePending(b.ID, c.anaToken, target)
				})
			}
			close(start)
			wg.Wait()

			var winner int64
			for i, resp := range responses {
				switch resp.Status {
				case http.StatusOK:
					if winner != 0 {
						t.Fatalf("two merges of B: responses %v", responses)
					}
					winner = []int64{first.ID, second.ID}[i]
				case http.StatusConflict:
					// Quem perdeu encontra B encerrado.
					if resp.Body["error"] != "Este chamado já foi encerrado." {
						t.Fatalf("loser %d: conflict with %v", i, resp.Body)
					}
				default:
					t.Fatalf("loser %d: status %d, body %v", i, resp.Status, resp.Body)
				}
			}
			if winner == 0 {
				t.Fatalf("no merge won: %v", responses)
			}
			if got := e.pendingState(winner); got.Status != "in_progress" {
				t.Fatalf("winner = %+v", got)
			}
			if got := e.mergedState(b.ID); got.MergedInto == nil || *got.MergedInto != winner {
				t.Fatalf("merged ticket = %+v, want into %d", got, winner)
			}
			// O pendente que perdeu continua pendente, com a mensagem dele.
			loser := first.ID
			if winner == first.ID {
				loser = second.ID
			}
			if got := e.pendingState(loser); got.Status != "pending" {
				t.Fatalf("loser = %+v", got)
			}
			// As mensagens de B ficaram no vencedor.
			for _, m := range e.messages(b.ID) {
				t.Fatalf("message left in the merged ticket: %+v", m)
			}
			if n := len(e.messages(winner)); n != 2 {
				t.Fatalf("messages of the winner = %d, want its own and the moved one", n)
			}
		})
	}
}

// A retomada de A pela lista e a mesclagem de B em A ao mesmo tempo: só a
// mesclagem vence, e as mensagens ficam num único chamado em atendimento.
func TestResumeByListLosesToTheMerge(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			b := c.pendingThenNewTicket()
			a := c.ticket

			var wg sync.WaitGroup
			var merged, resumed response
			start := make(chan struct{})
			wg.Go(func() {
				<-start
				merged = e.resumePending(b.ID, c.anaToken, a.ID)
			})
			wg.Go(func() {
				<-start
				resumed = e.resume(a.ID, c.biaToken)
			})
			close(start)
			wg.Wait()

			if merged.Status != http.StatusOK {
				t.Fatalf("merge: status %d, body %v", merged.Status, merged.Body)
			}
			if resumed.Status != http.StatusConflict {
				t.Fatalf("resume by list: status %d, body %v", resumed.Status, resumed.Body)
			}
			if got := e.pendingState(a.ID); got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != c.ana.ID {
				t.Fatalf("resumed ticket = %+v", got)
			}
			if got := e.mergedState(b.ID); got.ClosureType == nil || *got.ClosureType != "merged" {
				t.Fatalf("merged ticket = %+v", got)
			}
			open := 0
			for _, tk := range e.tickets(c.sector.ID) {
				if tk.Status == "queued" || tk.Status == "in_progress" {
					open++
				}
			}
			if open != 1 {
				t.Fatalf("open tickets = %d, want the resumed one", open)
			}
		})
	}
}

// Uma mensagem do cliente bem na hora da mesclagem cai num único chamado em
// atendimento, sem duplicar nem perder.
func TestConcurrentMessageAndResumePending(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			b := c.pendingThenNewTicket()
			a := c.ticket

			var wg sync.WaitGroup
			var merged response
			errs := make(chan error, 3)
			wg.Go(func() { merged = e.resumePending(b.ID, c.anaToken, a.ID) })
			for _, id := range []string{"MSG-3", "MSG-4", "MSG-3"} {
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
			if merged.Status != http.StatusOK {
				t.Fatalf("merge: status %d, body %v", merged.Status, merged.Body)
			}

			open := 0
			seen := map[string]int64{}
			for _, tk := range e.tickets(c.sector.ID) {
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
			if open != 1 || len(seen) != 4 {
				t.Fatalf("tickets = %+v, messages = %v", e.tickets(c.sector.ID), seen)
			}
			if got := e.pendingState(a.ID); got.Status != "in_progress" {
				t.Fatalf("resumed ticket = %+v", got)
			}
			if got := e.mergedState(b.ID); got.ClosureType == nil || *got.ClosureType != "merged" {
				t.Fatalf("merged ticket = %+v", got)
			}
			for _, id := range []string{"MSG-3", "MSG-4"} {
				if seen[id] != a.ID {
					t.Fatalf("message %s in ticket %d, want the resumed one", id, seen[id])
				}
			}
		})
	}
}
