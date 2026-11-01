package httpapi

import (
	"fmt"
	"net/http"
	"slices"
	"sync"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/messaging"
	"github.com/gcaspp-labs/xet/backend/internal/realtime"
)

// sectorTransfer is a ticket in progress with Ana, with the contact
// registered, and the RH sector as the destination.
type sectorTransfer struct {
	closing
	rh int64
}

func newSectorTransfer(t *testing.T) sectorTransfer {
	t.Helper()
	c := sectorTransfer{closing: newClosing(t)}
	c.register()
	c.rh = *c.e.userSector("rh@exemplo.com")
	return c
}

func (e *testEnv) userSector(email string) *int64 {
	e.t.Helper()
	u, err := e.q.GetUserByEmail(e.t.Context(), email)
	if err != nil {
		e.t.Fatal(err)
	}
	return u.SectorID
}

func (c sectorTransfer) transferForm(sectorID int64) map[string]any {
	return with(c.form(c.org), "sectorId", sectorID)
}

func (e *testEnv) transferSector(ticketID int64, token string, body map[string]any) response {
	e.t.Helper()
	return e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/transfer-sector", ticketID), token, body)
}

func TestTransferBetweenSectorsClosesOriginAndQueuesLinkedTicket(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	e.connectSector(c.rh)

	// O destino oferecido é outro setor ativo.
	sectors := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/transfer-sectors", c.ticket.ID), c.anaToken)
	if len(sectors) != 1 || sectors[0]["id"] != float64(c.rh) || sectors[0]["name"] != "RH" {
		t.Fatalf("transfer sectors = %v", sectors)
	}

	origin := e.subscribe(c.supToken)
	destination := e.subscribe(c.rhToken)
	before := time.Now()
	resp := e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh))
	if resp.status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.status, resp.body)
	}
	nextID := int64(resp.body["id"].(float64))
	if ev := e.nextEvent(origin); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("origin event = %+v", ev)
	}
	if ev := e.nextEvent(destination); ev != realtime.TicketChanged(c.rh, nextID) {
		t.Fatalf("destination event = %+v", ev)
	}

	// A etapa de origem fica encerrada como transferida, com o formulário completo.
	var closureType, subject string
	var closedBy int64
	if err := e.pool.QueryRow(t.Context(), `
		select closure_type::text, subject, closed_by_id from tickets where id = $1`, c.ticket.ID).
		Scan(&closureType, &subject, &closedBy); err != nil {
		t.Fatal(err)
	}
	if closureType != "transferred" || subject != "Contracheque" || closedBy != c.ana.ID {
		t.Fatalf("origin: type %s, subject %s, closed by %d", closureType, subject, closedBy)
	}
	if n := e.count("ticket_modules"); n != 2 {
		t.Fatalf("ticket_modules rows = %d", n)
	}

	// O novo chamado entra na fila do destino, vinculado, com o mesmo contato e órgão.
	tickets := e.tickets(c.rh)
	if len(tickets) != 1 || tickets[0].ID != nextID || tickets[0].Status != "queued" || tickets[0].ContactID != c.ticket.ContactID ||
		tickets[0].OrganizationID == nil || *tickets[0].OrganizationID != c.org || tickets[0].ArrivedAt.Before(before.Add(-time.Second)) {
		t.Fatalf("destination tickets = %+v", tickets)
	}
	var previous int64
	if err := e.pool.QueryRow(t.Context(), "select previous_ticket_id from tickets where id = $1", nextID).Scan(&previous); err != nil {
		t.Fatal(err)
	}
	if previous != c.ticket.ID {
		t.Fatalf("previous ticket = %d", previous)
	}

	// A auditoria da origem registra o encerramento e o destino.
	actions, changes := c.ticketActions()
	last := changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_transferred_sector" || last["status"]["to"] != "closed" ||
		last["sector_id"]["from"] != float64(c.sector.ID) || last["sector_id"]["to"] != float64(c.rh) ||
		last["next_ticket_id"]["to"] != float64(nextID) || last["subject"]["to"] != "Contracheque" {
		t.Fatalf("audit = %v, %v", actions, last)
	}

	// A origem mostra para onde foi e quem transferiu, sem acesso ao chamado do destino.
	detail := e.do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil).body
	next, _ := detail["next"].(map[string]any)
	if detail["closureType"] != "transferred" || next == nil || next["sectorName"] != "RH" || next["protocol"] != tickets[0].Protocol {
		t.Fatalf("origin detail = %v", detail)
	}
	logs := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.biaToken)
	if l := logs[len(logs)-1]; l["action"] != "ticket_transferred_sector" || l["toSectorName"] != "RH" ||
		l["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("origin timeline = %v", logs)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d", nextID), c.anaToken); status != http.StatusForbidden {
		t.Fatalf("origin reading the destination: status %d", status)
	}

	// O destino vê a origem e lê a conversa anterior completa, sem agir nela.
	detail = e.do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", nextID), c.rhToken, nil).body
	prev, _ := detail["previous"].(map[string]any)
	if prev == nil || prev["id"] != float64(c.ticket.ID) || prev["sectorName"] != "Contabilidade" ||
		prev["subject"] != "Contracheque" || prev["resolution"] != "Enviada a segunda via." || prev["closedByName"] != "ana@exemplo.com" {
		t.Fatalf("destination detail = %v", detail)
	}
	for _, path := range []string{"", "/messages", "/assignments", "/notes", "/modules", "/corrections"} {
		if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d%s", c.ticket.ID, path), c.rhToken); status != http.StatusOK {
			t.Fatalf("destination reading origin%s: status %d", path, status)
		}
	}
	if got := e.doList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/messages", c.ticket.ID), c.rhToken); len(got) != 1 {
		t.Fatalf("origin messages = %v", got)
	}
	if r := e.do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/notes", c.ticket.ID), c.rhToken, map[string]string{"body": "Nota"}); r.status != http.StatusForbidden {
		t.Fatalf("note on origin from destination: status %d", r.status)
	}
	body := c.data()
	body["subject"] = "Outro"
	if r := e.correct(c.ticket.ID, c.rhToken, body); r.status != http.StatusForbidden {
		t.Fatalf("correction from destination: status %d", r.status)
	}

	// Ao assumir, o destino escreve a primeira mensagem, enviada pelo próprio número.
	if r := e.assign(nextID, c.rhToken); r.status != http.StatusOK {
		t.Fatalf("assign destination: status %d", r.status)
	}
	if r := e.sendText(nextID, c.rhToken, requestA, "Olá, aqui é o RH."); r.status != http.StatusOK {
		t.Fatalf("first message: status %d, body %v", r.status, r.body)
	}
	sent := e.whatsapp.SentMessages()
	if msg, ok := sent[len(sent)-1].(messaging.TextMessage); !ok || msg.SectorID != c.rh || msg.Body != "Olá, aqui é o RH." {
		t.Fatalf("WhatsApp message = %+v", sent[len(sent)-1])
	}
}

// data is the closing data as recorded by the closing form, ready to be sent
// as a correction.
func (c sectorTransfer) data() map[string]any {
	var startedAt, endedAt time.Time
	if err := c.e.pool.QueryRow(c.e.t.Context(), "select started_at, ended_at from tickets where id = $1", c.ticket.ID).
		Scan(&startedAt, &endedAt); err != nil {
		c.e.t.Fatal(err)
	}
	return map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via.", "moduleIds": c.modules,
		"organizationId": c.org, "startedAt": startedAt, "endedAt": endedAt, "reason": "Ajuste",
	}
}

func TestOnlyTheAssigneeTransfersToAnotherSector(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	form := c.transferForm(c.rh)

	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken, "other sector": c.rhToken,
	} {
		if resp := e.transferSector(c.ticket.ID, token, form); resp.status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.status)
		}
	}
	for name, body := range map[string]map[string]any{
		"same sector":       with(form, "sectorId", c.sector.ID),
		"unknown sector":    with(form, "sectorId", 999999),
		"no sector":         with(form, "sectorId", nil),
		"no subject":        with(form, "subject", " "),
		"no modules":        with(form, "moduleIds", []int64{}),
		"inactive module":   with(form, "moduleIds", []int64{c.inactive}),
		"end in the future": with(form, "endedAt", time.Now().Add(time.Hour)),
	} {
		if resp := e.transferSector(c.ticket.ID, c.anaToken, body); resp.status != http.StatusUnprocessableEntity {
			t.Fatalf("%s: status %d, body %v", name, resp.status, resp.body)
		}
	}
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" {
		t.Fatalf("origin = %+v", got)
	}
	if got := e.tickets(c.rh); len(got) != 0 {
		t.Fatalf("destination tickets = %+v", got)
	}

	// Chamado na fila não é transferido: é assumido.
	queued := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.transferSector(queued.ID, c.anaToken, form); resp.status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.status)
	}
}

func TestUnregisteredContactIsNotTransferredToAnotherSector(t *testing.T) {
	t.Parallel()
	c := sectorTransfer{closing: newClosing(t)}
	c.rh = *c.e.userSector("rh@exemplo.com")
	resp := c.e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh))
	if resp.status != http.StatusUnprocessableEntity || resp.body["error"] != "Cadastre o contato e vincule-o a um órgão antes de transferir." {
		t.Fatalf("status %d, body %v", resp.status, resp.body)
	}
}

func TestTransferToSectorWithOpenTicketIsRefused(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	e.connectSector(c.rh)
	// O contato já escreveu para o número do RH.
	e.receive(c.rh, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Férias"))

	resp := e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh))
	if resp.status != http.StatusConflict || resp.body["error"] != "O contato já tem chamado aberto no setor de destino. Nada foi transferido." {
		t.Fatalf("status %d, body %v", resp.status, resp.body)
	}
	// Nada foi encerrado nem criado.
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" {
		t.Fatalf("origin = %+v", got)
	}
	if n := e.count("ticket_modules"); n != 0 {
		t.Fatalf("ticket_modules rows = %d", n)
	}
	if got := e.tickets(c.rh); len(got) != 1 {
		t.Fatalf("destination tickets = %+v", got)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] == "ticket_transferred_sector" {
		t.Fatalf("audit = %v", actions)
	}
}

func TestConcurrentTransfersToAnotherSectorTransferOnce(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e

	const attempts = 5
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh)).status
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
	if got := e.tickets(c.rh); len(got) != 1 {
		t.Fatalf("destination tickets = %+v", got)
	}
}

func TestTransferLinksTheContactToTheTargetSector(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	if resp := e.transferSector(c.ticket.ID, c.anaToken, c.transferForm(c.rh)); resp.status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.status, resp.body)
	}
	want := []int64{c.sector.ID, c.rh}
	slices.Sort(want)
	if got := e.contactSectors(c.ticket.ContactID); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Fatalf("sectors = %v, want %v", got, want)
	}
	actions, changes := e.auditChanges("contact", c.ticket.ContactID)
	if last := len(actions) - 1; actions[last] != "contact_sector_linked" || changes[last]["sector_id"]["to"] != float64(c.rh) {
		t.Fatalf("audit: %v %v", actions, changes)
	}
}
