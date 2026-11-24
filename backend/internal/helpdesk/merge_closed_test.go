package helpdesk_test

import (
	"fmt"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// mergeIntoPending merges the closed ticket into a pending one, as the screen of
// the correction does.
func (e *testEnv) mergeIntoPending(ticketID int64, token string, pendingID int64) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/merge-into-pending", ticketID), token,
		map[string]any{"pendingTicketId": pendingID})
}

// closedByMerge reads what the pending ticket inherited from the closed one, and
// what must not change.
type closedByMerge struct {
	Status         string
	ClosureType    *string
	Subject        *string
	Resolution     *string
	OrganizationID *int64
	ClosedByID     *int64
	AssigneeID     *int64
	AssignedAt     *time.Time
	StartedAt      time.Time
	EndedAt        *time.Time
	ClosedAt       *time.Time
	Modules        int
}

func (e *testEnv) closedByMerge(ticketID int64) closedByMerge {
	e.T.Helper()
	var c closedByMerge
	if err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, closure_type::text, subject, resolution, organization_id,
		       closed_by_id, assignee_id, assigned_at, started_at, ended_at, closed_at,
		       (select count(*) from ticket_modules where ticket_id = $1)
		from tickets where id = $1`, ticketID).
		Scan(&c.Status, &c.ClosureType, &c.Subject, &c.Resolution, &c.OrganizationID,
			&c.ClosedByID, &c.AssigneeID, &c.AssignedAt, &c.StartedAt, &c.EndedAt, &c.ClosedAt, &c.Modules); err != nil {
		e.T.Fatal(err)
	}
	return c
}

// auditReason reads the free text recorded with the last action of the ticket.
func (e *testEnv) auditReason(ticketID int64, action string) *string {
	e.T.Helper()
	var reason *string
	if err := e.Pool.QueryRow(e.T.Context(), `
		select reason from audit_logs where ticket_id = $1 and action = $2 order by id desc limit 1`,
		ticketID, action).Scan(&reason); err != nil {
		e.T.Fatal(err)
	}
	return reason
}

// moduleOf creates a module of the sector.
func (e *testEnv) moduleOf(sectorID int64, name string) int64 {
	e.T.Helper()
	m, err := e.Q.CreateModule(e.T.Context(), db.CreateModuleParams{SectorID: sectorID, Name: name})
	if err != nil {
		e.T.Fatal(err)
	}
	return m.ID
}

// registerContact registers the contact of the conversation with the sector,
// which the closing form needs for the organization.
func (c conversation) registerContact(org int64, phone string) {
	c.e.T.Helper()
	resp := c.e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria", "phone": phone, "organizationId": org, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		c.e.T.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
}

// pendingAndClosed prepares the pending A of the conversation's contact and, for
// the same contact and sector, the ticket B closed with the form by Ana. It
// returns A, B, the module and the organization of the closing.
func (c conversation) pendingAndClosed() (a, b ticketRow, module, org int64) {
	c.e.T.Helper()
	b = c.pendingThenNewTicket()
	a = c.ticket
	phone := "5511988887777"
	org = c.e.Organization(c.supToken, "Prefeitura de Campinas", "")
	c.registerContact(org, phone)
	module = c.e.moduleOf(c.sector.ID, "Folha")
	if resp := c.e.closeForm(b.ID, c.anaToken, map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via.",
		"moduleIds": []int64{module}, "organizationId": org,
	}); resp.Status != http.StatusOK {
		c.e.T.Fatalf("close B: status %d, body %v", resp.Status, resp.Body)
	}
	return a, b, module, org
}

func TestClosedTicketShowsThePendingsAndTheMergeAction(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	a, b, _, _ := c.pendingAndClosed()
	// Outro pendente do mesmo contato e setor não existe aqui: o B é de outro
	// contato.
	other := e.pendingOf(c.sector.ID, "MSG-9", "5511900000001", c.anaToken, "Aguardando nota fiscal")
	rh := *e.userSector("rh@exemplo.com")
	otherSector := e.pendingOf(rh, "MSG-10", "5511900000002", c.rhToken, "Aguardando laudo")

	detail := e.detailAs(b.ID, c.anaToken)
	pending, ok := detail["pendingTickets"].([]any)
	if !ok || len(pending) != 1 || detail["canMergeIntoPending"] != true {
		t.Fatalf("detail of B = %v", detail)
	}
	choice := pending[0].(map[string]any)
	by := choice["by"].(map[string]any)
	if int64(choice["id"].(float64)) != a.ID || choice["protocol"] != a.Protocol ||
		choice["reason"] != "Aguardando ajuste no sistema de folha" || by["name"] != "ana@exemplo.com" || choice["at"] == nil {
		t.Fatalf("pending choice = %v", choice)
	}
	for _, id := range []int64{other.ID, otherSector.ID} {
		for _, p := range pending {
			if int64(p.(map[string]any)["id"].(float64)) == id {
				t.Fatalf("pending of another contact or sector in the choices: %v", p)
			}
		}
	}

	// Quem não pode corrigir B não recebe as escolhas nem a ação.
	theirs := e.detailAs(b.ID, c.biaToken)
	if theirs["canMergeIntoPending"] != nil || theirs["pendingTickets"] != nil {
		t.Fatalf("detail of B for another agent = %v", theirs)
	}
	// O chamado em atendimento traz a lista de antes, sem a ação de mesclar.
	if got := e.detailAs(c.ticket.ID, c.anaToken); got["canMergeIntoPending"] != nil {
		t.Fatalf("pending ticket brought canMergeIntoPending: %v", got)
	}

	// Um transferido não é mesclado: não traz a ação.
	moved := newConversation(t)
	transferred := moved.pendingThenNewTicket()
	rhSector := *moved.e.userSector("rh@exemplo.com")
	if resp := moved.e.sectorTransfer(transferred.ID, moved.anaToken, map[string]any{"sectorId": rhSector}); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	if got := moved.e.detailAs(transferred.ID, moved.anaToken); got["canMergeIntoPending"] != nil || got["pendingTickets"] != nil {
		t.Fatalf("transferred ticket brought the merge action: %v", got)
	}
}

func TestMergeClosedIntoPendingMovesTheMessagesAndClosesA(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	b := c.pendingThenNewTicket()
	a := c.ticket
	ana := e.userID("ana@exemplo.com")
	assignedAt := e.assignment(a.ID).AssignedAt
	org := e.Organization(c.supToken, "Prefeitura de Campinas", "")
	c.registerContact(org, "5511988887777")
	module := e.moduleOf(c.sector.ID, "Folha")

	// B tem uma mensagem enviada com anexo, outra recebida, uma edição e uma
	// exclusão do cliente, uma reação do cliente e uma edição do responsável.
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
	if resp := e.closeForm(b.ID, c.anaToken, map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via.",
		"moduleIds": []int64{module}, "organizationId": org,
	}); resp.Status != http.StatusOK {
		t.Fatalf("close B: status %d, body %v", resp.Status, resp.Body)
	}
	bClosed := e.closedByMerge(b.ID)
	if bClosed.ClosedAt == nil || bClosed.EndedAt == nil {
		t.Fatalf("B closed = %+v", bClosed)
	}

	events := e.subscribe(c.biaToken)
	resp := e.mergeIntoPending(b.ID, c.anaToken, a.ID)
	if resp.Status != http.StatusOK || int64(resp.Body["id"].(float64)) != a.ID ||
		resp.Body["protocol"] != a.Protocol || resp.Body["status"] != "closed" ||
		resp.Body["closureType"] != "resolved" || resp.Body["assigneeId"] != float64(ana) {
		t.Fatalf("merge into pending: status %d, body %v", resp.Status, resp.Body)
	}
	// A e B avisam o setor depois do commit.
	for _, want := range []realtime.Event{realtime.TicketChanged(c.sector.ID, a.ID), realtime.TicketChanged(c.sector.ID, b.ID)} {
		if ev := e.nextEvent(events); ev != want {
			t.Fatalf("event = %+v, want %+v", ev, want)
		}
	}

	// A fica com a situação e os dados de encerramento de B; assigned_at e o
	// início de A não mudam.
	closed := e.closedByMerge(a.ID)
	if closed.Status != "closed" || closed.ClosureType == nil || *closed.ClosureType != "resolved" ||
		closed.Subject == nil || *closed.Subject != "Contracheque" ||
		closed.Resolution == nil || *closed.Resolution != "Enviada a segunda via." ||
		closed.OrganizationID == nil || *closed.OrganizationID != org ||
		closed.ClosedByID == nil || *closed.ClosedByID != ana ||
		closed.AssigneeID == nil || *closed.AssigneeID != ana ||
		closed.ClosedAt == nil || !closed.ClosedAt.Equal(*bClosed.ClosedAt) ||
		closed.EndedAt == nil || !closed.EndedAt.Equal(*bClosed.EndedAt) ||
		closed.Modules != 1 {
		t.Fatalf("A after the merge = %+v, B closed = %+v", closed, bClosed)
	}
	if closed.AssignedAt == nil || assignedAt == nil || !closed.AssignedAt.Equal(*assignedAt) {
		t.Fatalf("assigned_at = %v, want %v", closed.AssignedAt, assignedAt)
	}
	// B fica mesclado em A, sem assunto, resolução nem módulos.
	merged := e.mergedState(b.ID)
	if merged.Status != "closed" || merged.ClosureType == nil || *merged.ClosureType != "merged" ||
		merged.MergedInto == nil || *merged.MergedInto != a.ID ||
		merged.Subject != nil || merged.Resolution != nil || merged.Modules != 0 {
		t.Fatalf("merged ticket = %+v", merged)
	}
	// O encerramento de B fica como estava: o responsável e as datas.
	if merged.ClosedByID == nil || *merged.ClosedByID != ana ||
		merged.ClosedAt == nil || !merged.ClosedAt.Equal(*bClosed.ClosedAt) {
		t.Fatalf("merged ticket closing data = %+v, B before = %+v", merged, bClosed)
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
	var actionTicket int64
	if err := e.Pool.QueryRow(t.Context(), "select ticket_id from message_actions where message_id = $1", agentMessage.ID).Scan(&actionTicket); err != nil {
		t.Fatal(err)
	}
	if actionTicket != a.ID {
		t.Fatalf("message action of ticket %d, want %d", actionTicket, a.ID)
	}

	// Auditoria nos dois: B sabe em que chamado foi mesclado, quais mensagens
	// passaram e os dados que deixou; A sabe o que herdou e de qual chamado.
	actions, changes := e.AuditChanges("ticket", b.ID)
	last := changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_merged" || last["merged_into_ticket_id"]["to"] != float64(a.ID) ||
		len(last["message_ids"]["to"].([]any)) != 4 || last["closure_type"]["to"] != "merged" ||
		last["subject"]["from"] != "Contracheque" || last["subject"]["to"] != nil ||
		last["module_ids"]["from"].([]any)[0] != float64(module) || len(last["module_ids"]["to"].([]any)) != 0 {
		t.Fatalf("audit of B = %v %v", actions[len(actions)-1], last)
	}
	actions, changes = e.AuditChanges("ticket", a.ID)
	last = changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_closed_by_merge" || last["status"]["from"] != "pending" ||
		last["status"]["to"] != "closed" || last["merged_ticket_id"]["to"] != float64(b.ID) ||
		last["merged_protocol"]["to"] != b.Protocol || last["closure_type"]["to"] != "resolved" ||
		last["subject"]["to"] != "Contracheque" || last["organization_id"]["to"] != float64(org) ||
		last["closed_by_id"]["to"] != float64(ana) || last["assignee_id"]["to"] != float64(ana) ||
		last["module_ids"]["to"].([]any)[0] != float64(module) ||
		last["ended_at"]["to"] == nil || last["closed_at"]["to"] == nil {
		t.Fatalf("audit of A = %v %v", actions[len(actions)-1], last)
	}
	// Um encerrado não tem motivo de cancelamento para herdar.
	if r := e.auditReason(a.ID, "ticket_closed_by_merge"); r != nil {
		t.Fatalf("reason recorded in the merge of a resolved ticket = %v", *r)
	}

	// A conversa de A terá o aviso da mesclagem com o protocolo de B quando a
	// tela da #343 o mostrar; aqui a auditoria já guarda o vínculo e o
	// protocolo (merged_ticket_id e merged_protocol).

	// A sai de Pendentes e entra em Atendimentos com a situação e os dados de
	// B.
	for _, row := range e.pendingList(c.sector.ID, c.anaToken) {
		if int64(row["id"].(float64)) == a.ID {
			t.Fatalf("A still in Pendentes: %v", row)
		}
	}
	rows := e.DoPageItems(fmt.Sprintf("/api/closed-tickets?sectorId=%d", c.sector.ID), c.anaToken)
	var listRow map[string]any
	for _, row := range rows {
		if int64(row["id"].(float64)) == a.ID {
			listRow = row
		}
	}
	if listRow == nil || listRow["closureType"] != "resolved" || listRow["subject"] != "Contracheque" {
		t.Fatalf("A in Atendimentos = %v", listRow)
	}
	if modules, _ := listRow["modules"].([]any); len(modules) != 1 || modules[0] != "Folha" {
		t.Fatalf("modules of A in Atendimentos = %v", listRow["modules"])
	}

	// A continua corrigível pelas regras normais; B, mesclado, não.
	correction := map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via pelo sistema.",
		"moduleIds": []int64{module}, "organizationId": org,
		"startedAt": time.Now().Add(-2 * time.Hour), "endedAt": time.Now().Add(-time.Hour), "reason": "Ajuste do texto",
	}
	if resp := e.correct(a.ID, c.anaToken, correction); resp.Status != http.StatusOK {
		t.Fatalf("correction of A: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.correct(b.ID, c.anaToken, correction); resp.Status != http.StatusConflict ||
		resp.Body["error"] != "Chamado mesclado num pendente não é corrigido." {
		t.Fatalf("correction of the merged B: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestMergeCancelledTicketIntoPending(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	b := c.pendingThenNewTicket()
	a := c.ticket
	ana := e.userID("ana@exemplo.com")
	if resp := e.cancel(b.ID, c.anaToken, "Cliente desistiu"); resp.Status != http.StatusOK {
		t.Fatalf("cancel B: status %d, body %v", resp.Status, resp.Body)
	}
	cancelled := e.cancelled(b.ID)

	resp := e.mergeIntoPending(b.ID, c.anaToken, a.ID)
	if resp.Status != http.StatusOK || resp.Body["closureType"] != "cancelled" {
		t.Fatalf("merge into pending: status %d, body %v", resp.Status, resp.Body)
	}
	// A fica cancelado, com os dados de cancelamento de B.
	closed := e.closedByMerge(a.ID)
	sameOrganization := (closed.OrganizationID == nil) == (cancelled.organization == nil) &&
		(closed.OrganizationID == nil || *closed.OrganizationID == *cancelled.organization)
	if closed.Status != "closed" || closed.ClosureType == nil || *closed.ClosureType != "cancelled" ||
		closed.ClosedByID == nil || *closed.ClosedByID != ana ||
		closed.AssigneeID == nil || *closed.AssigneeID != ana ||
		closed.Subject != nil || closed.Resolution != nil || closed.Modules != 0 ||
		!sameOrganization ||
		closed.EndedAt == nil || closed.EndedAt.IsZero() || closed.ClosedAt == nil {
		t.Fatalf("A after the merge = %+v, B cancelled = %+v", closed, cancelled)
	}
	if got := e.mergedState(b.ID); got.ClosureType == nil || *got.ClosureType != "merged" || got.MergedInto == nil || *got.MergedInto != a.ID {
		t.Fatalf("merged ticket = %+v", got)
	}
	// A herda também o motivo do cancelamento de B: ele ficava só na auditoria
	// de B, que agora é um mesclado (spec #332, "os dados de cancelamento").
	if got := e.auditReason(a.ID, "ticket_closed_by_merge"); got == nil || *got != "Cliente desistiu" {
		t.Fatalf("reason of A = %v, want the cancellation reason of B", got)
	}
	// As mensagens de B passaram para A.
	if n := len(e.messages(b.ID)); n != 0 {
		t.Fatalf("messages of the merged ticket = %d", n)
	}
	if n := len(e.messages(a.ID)); n != 2 {
		t.Fatalf("messages of A = %d, want its own and the moved one", n)
	}
}

// Só quem pode corrigir B mescla: quem o encerrou, o supervisor e o
// administrador do setor; outro atendente do setor e o de outro setor não.
func TestMergeClosedIntoPendingPermissions(t *testing.T) {
	t.Parallel()
	cases := map[string]struct {
		token  func(c conversation) string
		status int
		error  string
	}{
		"who closed": {func(c conversation) string { return c.anaToken }, http.StatusOK, ""},
		"supervisor": {func(c conversation) string { return c.supToken }, http.StatusOK, ""},
		"admin":      {func(c conversation) string { return c.adminToken }, http.StatusOK, ""},
		"another agent of the sector": {func(c conversation) string { return c.biaToken }, http.StatusForbidden,
			"Apenas quem encerrou o atendimento e a supervisão do setor podem mesclá-lo num pendente."},
		"another sector": {func(c conversation) string { return c.rhToken }, http.StatusForbidden, "Você não tem acesso a este setor."},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			a, b, _, _ := c.pendingAndClosed()
			resp := c.e.mergeIntoPending(b.ID, tc.token(c), a.ID)
			if resp.Status != tc.status {
				t.Fatalf("status %d, body %v", resp.Status, resp.Body)
			}
			if tc.error != "" && resp.Body["error"] != tc.error {
				t.Fatalf("error = %v, want %q", resp.Body["error"], tc.error)
			}
			// Nada muda na recusa.
			if tc.status != http.StatusOK {
				if got := c.e.pendingState(a.ID); got.Status != "pending" {
					t.Fatalf("A after the refusal = %+v", got)
				}
				if got := c.e.mergedState(b.ID); got.ClosureType == nil || *got.ClosureType != "resolved" ||
					got.MergedInto != nil || len(c.e.messages(b.ID)) == 0 {
					t.Fatalf("B after the refusal = %+v", got)
				}
			}
		})
	}
}

func TestMergeClosedIntoPendingRefusals(t *testing.T) {
	t.Parallel()
	t.Run("B in progress", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		b := c.pendingThenNewTicket()
		a := c.ticket
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Só um atendimento encerrado ou cancelado é mesclado num pendente." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		assertNothingMerged(t, c, a.ID, b.ID, "in_progress")
	})
	t.Run("B in the queue", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		c.assign()
		c.markPending("Aguardando ajuste")
		a := c.ticket
		c.e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei"))
		b := c.e.queuedTicketOf(c.sector.ID, a.ContactID)
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Só um atendimento encerrado ou cancelado é mesclado num pendente." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		assertNothingMerged(t, c, a.ID, b.ID, "queued")
	})
	t.Run("B transferred", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		b := c.pendingThenNewTicket()
		a := c.ticket
		rh := *c.e.userSector("rh@exemplo.com")
		if resp := c.e.sectorTransfer(b.ID, c.anaToken, map[string]any{"sectorId": rh}); resp.Status != http.StatusOK {
			t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
		}
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Chamado transferido para outro setor não é mesclado num pendente." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		if got := c.e.pendingState(a.ID); got.Status != "pending" {
			t.Fatalf("A after the refusal = %+v", got)
		}
	})
	t.Run("B transferred with the old form", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		b := c.pendingThenNewTicket()
		a := c.ticket
		rh := *c.e.userSector("rh@exemplo.com")
		org := c.e.Organization(c.supToken, "Prefeitura de Campinas", "")
		module := c.e.moduleOf(c.sector.ID, "Folha")
		if resp := c.e.legacyTransfer(b.ID, c.anaToken, rh, org, "Contracheque", "Enviada a segunda via.", module); resp.Status != http.StatusOK {
			t.Fatalf("legacy transfer: status %d, body %v", resp.Status, resp.Body)
		}
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Chamado transferido para outro setor não é mesclado num pendente." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		if got := c.e.pendingState(a.ID); got.Status != "pending" {
			t.Fatalf("A after the refusal = %+v", got)
		}
	})
	t.Run("B already merged", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		a, b, _, _ := c.pendingAndClosed()
		if resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusOK {
			t.Fatalf("merge: status %d, body %v", resp.Status, resp.Body)
		}
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Chamado mesclado num pendente não é mesclado de novo." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
	})
	t.Run("A not pending", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		a, b, _, _ := c.pendingAndClosed()
		if resp := c.e.resume(a.ID, c.biaToken); resp.Status != http.StatusOK {
			t.Fatalf("resume A: status %d, body %v", resp.Status, resp.Body)
		}
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, a.ID)
		if resp.Status != http.StatusConflict ||
			resp.Body["error"] != "Este chamado pendente não está mais pendente. Atualize a lista e tente novamente." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		if got := c.e.mergedState(b.ID); got.ClosureType == nil || *got.ClosureType != "resolved" || got.MergedInto != nil {
			t.Fatalf("B after the refusal = %+v", got)
		}
	})
	t.Run("A of another contact", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		a, b, _, _ := c.pendingAndClosed()
		other := c.e.pendingOf(c.sector.ID, "MSG-9", "5511900000001", c.anaToken, "Aguardando nota fiscal")
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, other.ID)
		if resp.Status != http.StatusUnprocessableEntity ||
			resp.Body["error"] != "Escolha um chamado pendente do mesmo contato e setor." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		if got := c.e.pendingState(a.ID); got.Status != "pending" {
			t.Fatalf("A after the refusal = %+v", got)
		}
		if got := c.e.mergedState(b.ID); got.MergedInto != nil {
			t.Fatalf("B after the refusal = %+v", got)
		}
	})
	t.Run("A of another sector", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		a, b, _, _ := c.pendingAndClosed()
		rh := *c.e.userSector("rh@exemplo.com")
		otherSector := c.e.pendingOf(rh, "MSG-10", "5511988887777", c.rhToken, "Aguardando laudo")
		resp := c.e.mergeIntoPending(b.ID, c.anaToken, otherSector.ID)
		if resp.Status != http.StatusUnprocessableEntity ||
			resp.Body["error"] != "Escolha um chamado pendente do mesmo contato e setor." {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
		if got := c.e.pendingState(otherSector.ID); got.Status != "pending" {
			t.Fatalf("A of the other sector after the refusal = %+v", got)
		}
		if got := c.e.pendingState(a.ID); got.Status != "pending" {
			t.Fatalf("A after the refusal = %+v", got)
		}
	})
	t.Run("unknown pending", func(t *testing.T) {
		t.Parallel()
		c := newConversation(t)
		_, b, _, _ := c.pendingAndClosed()
		if resp := c.e.mergeIntoPending(b.ID, c.anaToken, 999999); resp.Status != http.StatusNotFound {
			t.Fatalf("status %d, body %v", resp.Status, resp.Body)
		}
	})
}

// assertNothingMerged checks a refusal that found B open: A stays pending and B
// keeps its state and messages.
func assertNothingMerged(t *testing.T, c conversation, aID, bID int64, bStatus string) {
	t.Helper()
	if got := c.e.pendingState(aID); got.Status != "pending" {
		t.Fatalf("A after the refusal = %+v", got)
	}
	if got := c.e.mergedState(bID); got.Status != bStatus || got.MergedInto != nil {
		t.Fatalf("B after the refusal = %+v", got)
	}
	if len(c.e.messages(bID)) == 0 {
		t.Fatalf("messages left B in the refusal")
	}
}

// A retomada de A pela lista e a mesclagem de B encerrado em A ao mesmo tempo:
// só uma vence; a outra recebe o erro e nada muda.
func TestResumeByListLosesToTheMergeOfAClosedTicket(t *testing.T) {
	t.Parallel()
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			a, b, _, _ := c.pendingAndClosed()
			ana := e.userID("ana@exemplo.com")
			bia := e.userID("bia@exemplo.com")

			var wg sync.WaitGroup
			var merged, resumed response
			start := make(chan struct{})
			wg.Go(func() {
				<-start
				merged = e.mergeIntoPending(b.ID, c.anaToken, a.ID)
			})
			wg.Go(func() {
				<-start
				resumed = e.resume(a.ID, c.biaToken)
			})
			close(start)
			wg.Wait()

			switch {
			case merged.Status == http.StatusOK:
				// A retomada chegou depois: encontra A encerrado.
				if resumed.Status != http.StatusConflict {
					t.Fatalf("resume by list: status %d, body %v (merge won)", resumed.Status, resumed.Body)
				}
				got := e.closedByMerge(a.ID)
				if got.Status != "closed" || got.ClosureType == nil || *got.ClosureType != "resolved" ||
					got.AssigneeID == nil || *got.AssigneeID != ana {
					t.Fatalf("A after the merge = %+v", got)
				}
				if m := e.mergedState(b.ID); m.MergedInto == nil || *m.MergedInto != a.ID {
					t.Fatalf("B after the merge = %+v", m)
				}
				if n := len(e.messages(a.ID)); n != 2 {
					t.Fatalf("messages of A = %d, want its own and the moved one", n)
				}
				if n := len(e.messages(b.ID)); n != 0 {
					t.Fatalf("messages left in B = %d", n)
				}
			case resumed.Status == http.StatusOK:
				// A mesclagem chegou depois: encontra A em atendimento.
				if merged.Status != http.StatusConflict ||
					merged.Body["error"] != "Este chamado pendente não está mais pendente. Atualize a lista e tente novamente." {
					t.Fatalf("merge: status %d, body %v (resume won)", merged.Status, merged.Body)
				}
				got := e.pendingState(a.ID)
				if got.Status != "in_progress" || got.AssigneeID == nil || *got.AssigneeID != bia {
					t.Fatalf("A after the resume = %+v", got)
				}
				if m := e.mergedState(b.ID); m.ClosureType == nil || *m.ClosureType != "resolved" || m.MergedInto != nil {
					t.Fatalf("B after the refusal = %+v", m)
				}
				if n := len(e.messages(b.ID)); n != 1 {
					t.Fatalf("messages of B = %d, want its own", n)
				}
			default:
				t.Fatalf("neither won: merge %d %v, resume %d %v", merged.Status, merged.Body, resumed.Status, resumed.Body)
			}
		})
	}
}

// Dois atendimentos encerrados mesclados no mesmo pendente ao mesmo tempo: só
// um vence; o outro recebe o erro e nada muda nele (spec #332, "ou mescla outro
// chamado nele").
func TestTwoClosedTicketsMergedIntoTheSamePendingAtOnce(t *testing.T) {
	t.Parallel()
	const notPending = "Este chamado pendente não está mais pendente. Atualize a lista e tente novamente."
	for i := range 6 {
		t.Run(fmt.Sprint(i), func(t *testing.T) {
			t.Parallel()
			c := newConversation(t)
			e := c.e
			a, b1, module, org := c.pendingAndClosed()
			// O contato volta a escrever e abre outro chamado, que Ana assume e
			// encerra como o primeiro.
			e.receive(c.sector.ID, text("MSG-7", "5511988887777@s.whatsapp.net", "5511988887777", "E as férias?"))
			b2 := e.queuedTicketOf(c.sector.ID, a.ContactID)
			if resp := e.assign(b2.ID, c.anaToken); resp.Status != http.StatusOK {
				t.Fatalf("assign B2: status %d, body %v", resp.Status, resp.Body)
			}
			if resp := e.closeForm(b2.ID, c.anaToken, map[string]any{
				"subject": "Férias", "resolution": "Programadas para janeiro.",
				"moduleIds": []int64{module}, "organizationId": org,
			}); resp.Status != http.StatusOK {
				t.Fatalf("close B2: status %d, body %v", resp.Status, resp.Body)
			}

			var wg sync.WaitGroup
			var first, second response
			start := make(chan struct{})
			wg.Go(func() {
				<-start
				first = e.mergeIntoPending(b1.ID, c.anaToken, a.ID)
			})
			wg.Go(func() {
				<-start
				second = e.mergeIntoPending(b2.ID, c.anaToken, a.ID)
			})
			close(start)
			wg.Wait()

			won, lost, wantSubject := b1, b2, "Contracheque"
			loseStatus, loseBody := second.Status, second.Body
			if second.Status == http.StatusOK {
				won, lost, wantSubject = b2, b1, "Férias"
				loseStatus, loseBody = first.Status, first.Body
			}
			if first.Status == http.StatusOK && second.Status == http.StatusOK {
				t.Fatalf("both merges won: A cannot take two closed tickets")
			}
			if first.Status != http.StatusOK && second.Status != http.StatusOK {
				t.Fatalf("neither won: merge B1 %d %v, merge B2 %d %v", first.Status, first.Body, second.Status, second.Body)
			}
			// O que chegou depois encontra A encerrado e não muda nada.
			if loseStatus != http.StatusConflict || loseBody["error"] != notPending {
				t.Fatalf("losing merge: status %d, body %v", loseStatus, loseBody)
			}

			// A fica com os dados e as mensagens do vencedor, e nada do perdedor.
			closed := e.closedByMerge(a.ID)
			if closed.Status != "closed" || closed.ClosureType == nil || *closed.ClosureType != "resolved" ||
				closed.Subject == nil || *closed.Subject != wantSubject {
				t.Fatalf("A after the merge = %+v, winner = %d", closed, won.ID)
			}
			if m := e.mergedState(won.ID); m.MergedInto == nil || *m.MergedInto != a.ID {
				t.Fatalf("winner after the merge = %+v", m)
			}
			if n := len(e.messages(a.ID)); n != 2 {
				t.Fatalf("messages of A = %d, want its own and the winner's", n)
			}
			if n := len(e.messages(won.ID)); n != 0 {
				t.Fatalf("messages left in the winner = %d", n)
			}
			// O perdedor continua encerrado, com a mensagem dele e sem vínculo.
			if m := e.mergedState(lost.ID); m.MergedInto != nil ||
				m.ClosureType == nil || *m.ClosureType != "resolved" {
				t.Fatalf("loser after the refusal = %+v", m)
			}
			if n := len(e.messages(lost.ID)); n != 1 {
				t.Fatalf("messages of the loser = %d, want its own", n)
			}
			// E A guarda uma mesclagem só.
			actions, _ := e.AuditChanges("ticket", a.ID)
			merges := 0
			for _, action := range actions {
				if action == "ticket_closed_by_merge" {
					merges++
				}
			}
			if merges != 1 {
				t.Fatalf("merges recorded in A = %d, want 1 (%v)", merges, actions)
			}
		})
	}
}

// Números do Dashboard depois de mesclar B encerrado em A: B sai de Encerrados
// e do tempo médio, A entra na data de encerramento de B, o responsável é o de
// B e o tempo de espera de A não muda. O desconto do tempo pendente e dos
// mesclados na média é a #336, e não entra aqui.
func TestDashboardAfterMergingAClosedTicketIntoAPending(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	query := filtered("sectorId", d.contab.ID)
	contact, phone := d.contact(d.orgA)
	a := d.e.queuedTicket(d.contab.ID, "IN-A", phone)
	if resp := d.e.assign(a.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign A: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := d.e.markPending(a.ID, d.anaToken, "Aguardando resposta do órgão"); resp.Status != http.StatusOK {
		t.Fatalf("mark A pending: status %d, body %v", resp.Status, resp.Body)
	}
	// B nasce da mensagem seguinte do mesmo contato, é assumido e encerrado por
	// Bia.
	d.e.receive(d.contab.ID, text("IN-B", phone+"@s.whatsapp.net", phone, "Voltei, o problema continua"))
	b := d.e.queuedTicketOf(d.contab.ID, contact)
	if resp := d.e.assign(b.ID, d.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign B: status %d, body %v", resp.Status, resp.Body)
	}
	d.close(b.ID, d.biaToken, d.form(d.orgA, d.modA))

	// Tudo na data do dia do teste: A esperou 2 h antes de ser assumido e B
	// chegou 2 h antes de ser assumido, e o atendimento de B acaba ao meio-dia.
	aArrived := dashboardNoon.Add(-6 * time.Hour)
	aAssigned := dashboardNoon.Add(-4 * time.Hour)
	d.setTimes(a.ID, ticketTimes{arrived: &aArrived, assigned: &aAssigned})
	bArrived := dashboardNoon.Add(-2 * time.Hour)
	bAssigned := dashboardNoon.Add(-time.Hour)
	d.setTimes(b.ID, ticketTimes{arrived: &bArrived, assigned: &bAssigned, ended: &dashboardNoon, closed: &dashboardNoon})
	waitBefore := d.number(d.supToken, query, "averageWaitSeconds")
	bClosed := d.e.closedByMerge(b.ID)

	if resp := d.e.mergeIntoPending(b.ID, d.biaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("merge: status %d, body %v", resp.Status, resp.Body)
	}

	// A aparece em Atendimentos na data de encerramento de B.
	closed := d.e.closedByMerge(a.ID)
	if closed.Status != "closed" || closed.ClosureType == nil || *closed.ClosureType != "resolved" ||
		closed.ClosedAt == nil || bClosed.ClosedAt == nil || !closed.ClosedAt.Equal(*bClosed.ClosedAt) {
		t.Fatalf("A after the merge = %+v, B closed = %+v", closed, bClosed)
	}

	numbers := d.numbers(d.supToken, query)
	// B saiu de Encerrados (o mesclado não conta) e A entrou no lugar.
	if numbers["resolved"] != 1 || numbers["transferred"] != 0 || numbers["cancelled"] != 0 {
		t.Fatalf("numbers = %v", numbers)
	}
	// B continua em Recebidos: o contato chegou de fato, nas duas vezes.
	if numbers["received"] != 2 {
		t.Fatalf("received = %v, want A and B", numbers["received"])
	}
	// O tempo de espera de A não muda.
	if numbers["averageWaitSeconds"] != waitBefore {
		t.Fatalf("average wait = %v, want %v", numbers["averageWaitSeconds"], waitBefore)
	}
	// O atendimento é de quem encerrou B, que é o responsável herdado por A.
	_, rows := d.rows(d.supToken, query)
	if row := rows[d.bia.Name+"/Contabilidade"]; row["resolved"] != 1 {
		t.Fatalf("row of Bia = %v", row)
	}
	if _, ok := rows[d.ana.Name+"/Contabilidade"]; ok {
		t.Fatalf("A counted for Ana, who marked it pending: %v", rows)
	}
}
