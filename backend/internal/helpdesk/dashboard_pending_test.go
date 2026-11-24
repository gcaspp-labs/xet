package helpdesk_test

import (
	"net/http"
	"testing"
	"time"
)

// auditIDs returns the audit rows of the action on the ticket, oldest first.
func (d *dashboardFixture) auditIDs(ticketID int64, action string) []int64 {
	d.e.T.Helper()
	rows, err := d.e.Pool.Query(d.e.T.Context(),
		"select id from audit_logs where ticket_id = $1 and action = $2 order by id", ticketID, action)
	if err != nil {
		d.e.T.Fatal(err)
	}
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			d.e.T.Fatal(err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		d.e.T.Fatal(err)
	}
	return ids
}

// userName reads the name of the user of the email, the first part of the key
// of the assignee table.
func (d *dashboardFixture) userName(email string) string {
	d.e.T.Helper()
	var name string
	if err := d.e.Pool.QueryRow(d.e.T.Context(), "select name from users where email = $1", email).Scan(&name); err != nil {
		d.e.T.Fatal(err)
	}
	return name + "/Contabilidade"
}

// setAuditAt moves the moment of an audit row, which the dashboard reads for
// the pending periods.
func (d *dashboardFixture) setAuditAt(id int64, at time.Time) {
	d.e.T.Helper()
	if _, err := d.e.Pool.Exec(d.e.T.Context(),
		"update audit_logs set created_at = $2 where id = $1", id, at); err != nil {
		d.e.T.Fatal(err)
	}
}

// setPendingPeriods fixes the pending and resuming moments of the ticket, in
// order: pending[i] is followed by resume[i]. A ticket closed by the merge of a
// closed one has no resume: its last pending period is fixed by the assignment
// of the merged ticket, set with setTimes.
func (d *dashboardFixture) setPendingPeriods(ticketID int64, periods ...[2]time.Time) {
	d.e.T.Helper()
	pending, resumed := d.auditIDs(ticketID, "ticket_pending"), d.auditIDs(ticketID, "ticket_resumed")
	if len(pending) != len(periods) || len(resumed) != len(periods) {
		d.e.T.Fatalf("audit: %d pending, %d resumed, want %d", len(pending), len(resumed), len(periods))
	}
	for i, period := range periods {
		d.setAuditAt(pending[i], period[0])
		d.setAuditAt(resumed[i], period[1])
	}
}

// TestDashboardHandlingDiscountsEveryPendingPeriod: cada período pendente sai
// do tempo de atendimento, o tempo de espera não muda, e o atendimento fica
// com quem retomou da última vez e encerrou.
func TestDashboardHandlingDiscountsEveryPendingPeriod(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	d := &dashboardFixture{e: c.e}
	query := filtered("sectorId", c.sector.ID)
	org := c.e.Organization(c.supToken, "Prefeitura", "")
	module := c.e.moduleOf(c.sector.ID, "Folha")
	c.registerContact(org, "5511988887777")

	c.assign()
	ticket := c.ticket
	if resp := c.e.markPending(ticket.ID, c.anaToken, "Aguardando o sistema de folha"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.resume(ticket.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.markPending(ticket.ID, c.anaToken, "Aguardando a nota fiscal"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending again: status %d, body %v", resp.Status, resp.Body)
	}
	// A Bia retoma e encerra: o atendimento é dela, não da Ana.
	if resp := c.e.resume(ticket.ID, c.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("resume by bia: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.closeForm(ticket.ID, c.biaToken, d.form(org, module)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}

	// Dois períodos pendentes de 10 minutos cada, dentro de 50 minutos de
	// atendimento: 3000 - 1200 = 1800 s.
	d.setPendingPeriods(ticket.ID,
		[2]time.Time{dashboardNoon.Add(10 * time.Minute), dashboardNoon.Add(20 * time.Minute)},
		[2]time.Time{dashboardNoon.Add(30 * time.Minute), dashboardNoon.Add(40 * time.Minute)})
	arrived := dashboardNoon.Add(-10 * time.Minute)
	ended := dashboardNoon.Add(50 * time.Minute)
	d.setTimes(ticket.ID, ticketTimes{arrived: &arrived, assigned: &dashboardNoon, ended: &ended, closed: &ended})

	numbers := d.numbers(c.supToken, query)
	if numbers["resolved"] != 1 || numbers["averageHandlingSeconds"] != 1800 || numbers["averageWaitSeconds"] != 600 {
		t.Fatalf("numbers = %v", numbers)
	}
	order, rows := d.rows(c.supToken, query)
	bia := d.userName("bia@exemplo.com")
	if len(order) != 1 || order[0] != bia || rows[bia]["resolved"] != 1 || rows[bia]["averageHandlingSeconds"] != 1800 {
		t.Fatalf("rows = %v, %v", order, rows)
	}
}

// TestDashboardHandlingDiscountsThePendingResumedByMerge: retomar o pendente a
// partir de um chamado novo (#335) fecha o período pendente na hora da
// mesclagem, e o novo chamado não entra nos encerramentos.
func TestDashboardHandlingDiscountsThePendingResumedByMerge(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	d := &dashboardFixture{e: c.e}
	query := filtered("sectorId", c.sector.ID)
	org := c.e.Organization(c.supToken, "Prefeitura", "")
	module := c.e.moduleOf(c.sector.ID, "Folha")
	c.registerContact(org, "5511988887777")

	c.assign()
	a := c.ticket
	if resp := c.e.markPending(a.ID, c.anaToken, "Aguardando o sistema de folha"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	c.e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei, o problema continua"))
	b := c.e.queuedTicketOf(c.sector.ID, a.ContactID)
	if resp := c.e.assign(b.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign B: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.resumePending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("resume pending: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.closeForm(a.ID, c.anaToken, d.form(org, module)); resp.Status != http.StatusOK {
		t.Fatalf("close A: status %d, body %v", resp.Status, resp.Body)
	}

	// Pendente de 15 minutos, dentro de 45 de atendimento: 2700 - 900 = 1800 s.
	pending := d.auditIDs(a.ID, "ticket_pending")
	resumed := d.auditIDs(a.ID, "ticket_resumed_by_merge")
	if len(pending) != 1 || len(resumed) != 1 {
		t.Fatalf("audit: %d pending, %d resumed by merge", len(pending), len(resumed))
	}
	d.setAuditAt(pending[0], dashboardNoon.Add(10*time.Minute))
	d.setAuditAt(resumed[0], dashboardNoon.Add(25*time.Minute))
	ended := dashboardNoon.Add(45 * time.Minute)
	d.setTimes(a.ID, ticketTimes{arrived: &dashboardNoon, assigned: &dashboardNoon, ended: &ended, closed: &ended})
	d.setTimes(b.ID, ticketTimes{arrived: &dashboardNoon})

	numbers := d.numbers(c.supToken, query)
	if numbers["resolved"] != 1 || numbers["transferred"] != 0 || numbers["cancelled"] != 0 ||
		numbers["averageHandlingSeconds"] != 1800 || numbers["received"] != 2 {
		t.Fatalf("numbers = %v", numbers)
	}
	_, rows := d.rows(c.supToken, query)
	ana := c.ana.Name + "/Contabilidade"
	if row := rows[ana]; row["resolved"] != 1 || row["averageHandlingSeconds"] != 1800 {
		t.Fatalf("row = %v", row)
	}
}

// closedByMergeScenario prepares A, pending of Ana, and B of the same contact
// in progress with Bia and closed by her. Nobody merges yet: the test chooses
// the moments and the merge.
func closedByMergeScenario(t *testing.T) (c conversation, d *dashboardFixture, a, b ticketRow, org, module int64) {
	t.Helper()
	c = newConversation(t)
	d = &dashboardFixture{e: c.e}
	org = c.e.Organization(c.supToken, "Prefeitura", "")
	module = c.e.moduleOf(c.sector.ID, "Folha")
	c.registerContact(org, "5511988887777")

	c.assign()
	a = c.ticket
	if resp := c.e.markPending(a.ID, c.anaToken, "Aguardando ajuste"); resp.Status != http.StatusOK {
		c.e.T.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	c.e.receive(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Voltei"))
	b = c.e.queuedTicketOf(c.sector.ID, a.ContactID)
	if resp := c.e.assign(b.ID, c.biaToken); resp.Status != http.StatusOK {
		c.e.T.Fatalf("assign B: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.closeForm(b.ID, c.biaToken, d.form(org, module)); resp.Status != http.StatusOK {
		c.e.T.Fatalf("close B: status %d, body %v", resp.Status, resp.Body)
	}
	return c, d, a, b, org, module
}

// TestDashboardPendingClosedByMergeDiscountsUntilTheMergedAssignment: mesclar
// um atendimento encerrado (#341) no pendente desconta o período pendente até
// quando B foi assumido; A conta no lugar de B, na data de B, para o responsável
// de B.
func TestDashboardPendingClosedByMergeDiscountsUntilTheMergedAssignment(t *testing.T) {
	t.Parallel()
	c, d, a, b, _, _ := closedByMergeScenario(t)
	query := filtered("sectorId", c.sector.ID)
	if resp := c.e.mergeIntoPending(b.ID, c.biaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("merge into pending: status %d, body %v", resp.Status, resp.Body)
	}

	// A foi marcado pendente às 12:10 e B foi assumido às 12:25: 15 minutos
	// descontados de 45: 2700 - 900 = 1800 s.
	pending := d.auditIDs(a.ID, "ticket_pending")
	if len(pending) != 1 {
		t.Fatalf("audit: %d pending", len(pending))
	}
	d.setAuditAt(pending[0], dashboardNoon.Add(10*time.Minute))
	bAssigned := dashboardNoon.Add(25 * time.Minute)
	ended := dashboardNoon.Add(45 * time.Minute)
	d.setTimes(a.ID, ticketTimes{arrived: &dashboardNoon, assigned: &dashboardNoon, ended: &ended, closed: &ended})
	d.setTimes(b.ID, ticketTimes{arrived: &dashboardNoon, assigned: &bAssigned, ended: &ended, closed: &ended})

	numbers := d.numbers(c.supToken, query)
	if numbers["resolved"] != 1 || numbers["cancelled"] != 0 || numbers["averageHandlingSeconds"] != 1800 {
		t.Fatalf("numbers = %v", numbers)
	}
	order, rows := d.rows(c.supToken, query)
	bia := d.userName("bia@exemplo.com")
	if len(order) != 1 || order[0] != bia || rows[bia]["resolved"] != 1 || rows[bia]["averageHandlingSeconds"] != 1800 {
		t.Fatalf("rows = %v, %v", order, rows)
	}
}

// TestDashboardPendingClosedByMergeWithTheAssignmentBeforeThePending: quando B
// foi assumido antes de A ficar pendente, o desconto fica em zero e o tempo de
// atendimento é o intervalo inteiro.
func TestDashboardPendingClosedByMergeWithTheAssignmentBeforeThePending(t *testing.T) {
	t.Parallel()
	c, d, a, b, _, _ := closedByMergeScenario(t)
	query := filtered("sectorId", c.sector.ID)
	if resp := c.e.mergeIntoPending(b.ID, c.biaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("merge into pending: status %d, body %v", resp.Status, resp.Body)
	}

	pending := d.auditIDs(a.ID, "ticket_pending")
	if len(pending) != 1 {
		t.Fatalf("audit: %d pending", len(pending))
	}
	d.setAuditAt(pending[0], dashboardNoon.Add(10*time.Minute))
	bAssigned := dashboardNoon.Add(5 * time.Minute)
	ended := dashboardNoon.Add(45 * time.Minute)
	d.setTimes(a.ID, ticketTimes{arrived: &dashboardNoon, assigned: &dashboardNoon, ended: &ended, closed: &ended})
	d.setTimes(b.ID, ticketTimes{arrived: &dashboardNoon, assigned: &bAssigned, ended: &ended, closed: &ended})

	numbers := d.numbers(c.supToken, query)
	if numbers["averageHandlingSeconds"] != 2700 {
		t.Fatalf("numbers = %v", numbers)
	}
}

// TestDashboardCountsMergedTicketAsItArrived: o chamado mesclado deixa de ter
// mensagens próprias, mas continua contando na chegada como chegou. Um chamado
// iniciado pelo celular do setor continua iniciado, não passa a recebido.
func TestDashboardCountsMergedTicketAsItArrived(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	d := &dashboardFixture{e: c.e}
	query := filtered("sectorId", c.sector.ID)

	c.assign()
	a := c.ticket
	if resp := c.e.markPending(a.ID, c.anaToken, "Aguardando o sistema"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: status %d, body %v", resp.Status, resp.Body)
	}
	// Mensagem enviada pelo celular do setor: o chamado novo é iniciado, não
	// recebido, e a mensagem dele passa para A na mesclagem.
	c.e.sendOutside(c.sector.ID, text("MSG-2", "5511988887777@s.whatsapp.net", "5511988887777", "Bom dia"))
	b := c.e.queuedTicketOf(c.sector.ID, a.ContactID)
	if resp := c.e.assign(b.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign B: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := c.e.resumePending(b.ID, c.anaToken, a.ID); resp.Status != http.StatusOK {
		t.Fatalf("resume pending: status %d, body %v", resp.Status, resp.Body)
	}
	d.setTimes(a.ID, ticketTimes{arrived: &dashboardNoon})
	d.setTimes(b.ID, ticketTimes{arrived: &dashboardNoon})

	numbers := d.numbers(c.supToken, query)
	if numbers["received"] != 1 || numbers["started"] != 1 {
		t.Fatalf("numbers = %v, want the pending one received and the merged one started", numbers)
	}
	if numbers["resolved"] != 0 || numbers["transferred"] != 0 || numbers["cancelled"] != 0 || numbers["averageHandlingSeconds"] != nil {
		t.Fatalf("numbers = %v, want the merged one out of the closings", numbers)
	}
}
