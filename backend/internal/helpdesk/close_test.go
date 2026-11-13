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

// closing is a conversation in progress with Ana, whose contact is not yet
// registered, and the modules of the sector.
type closing struct {
	conversation
	org      int64 // main organization used to register the contact
	modules  []int64
	inactive int64 // inactive module of the sector
	rhModule int64 // module of another sector
}

func newClosing(t *testing.T) closing {
	t.Helper()
	c := closing{conversation: newConversation(t)}
	e := c.e
	c.assign()
	c.org = e.Organization(c.supToken, "Prefeitura de Campinas", "")
	for _, name := range []string{"Folha", "Patrimônio"} {
		m, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: name})
		if err != nil {
			t.Fatal(err)
		}
		c.modules = append(c.modules, m.ID)
	}
	m, err := e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: c.sector.ID, Name: "Antigo"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: m.ID, Name: m.Name, Active: false}); err != nil {
		t.Fatal(err)
	}
	c.inactive = m.ID
	rh, err := e.Q.GetUserByEmail(t.Context(), "rh@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	m, err = e.Q.CreateModule(t.Context(), db.CreateModuleParams{SectorID: *rh.SectorID, Name: "Folha"})
	if err != nil {
		t.Fatal(err)
	}
	c.rhModule = m.ID
	return c
}

// register links the contact of the ticket to the organization.
func (c closing) register() {
	c.e.T.Helper()
	resp := c.e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		c.e.T.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
}

func (c closing) form(org int64) map[string]any {
	return map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via.",
		"moduleIds": c.modules, "organizationId": org,
		"subjectModuleId": c.modules[0], "solutionModuleId": c.modules[0],
	}
}

func (e *testEnv) closeForm(ticketID int64, token string, form map[string]any) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/close", ticketID), token, form)
}

func with(form map[string]any, key string, value any) map[string]any {
	out := make(map[string]any, len(form))
	for k, v := range form {
		out[k] = v
	}
	if value == nil {
		delete(out, key)
	} else {
		out[key] = value
	}
	return out
}

func TestCloseRecordsTheClosingForm(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	other := e.Organization(c.supToken, "Câmara de Campinas", "")

	// O formulário começa com os módulos ativos do setor, o órgão do contato e o início automático.
	resp := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("closing form: status %d", resp.Status)
	}
	form := resp.Body
	modules, _ := form["modules"].([]any)
	if len(modules) != 2 || modules[0].(map[string]any)["name"] != "Folha" || modules[1].(map[string]any)["name"] != "Patrimônio" {
		t.Fatalf("form modules = %v", form["modules"])
	}
	if org := form["organization"].(map[string]any); org["id"] != float64(c.org) || org["municipality"].(map[string]any)["name"] != "Itu" {
		t.Fatalf("form organization = %v", form["organization"])
	}
	started, err := time.Parse(time.RFC3339Nano, form["startedAt"].(string))
	if err != nil || !started.Equal(c.ticket.ArrivedAt) {
		t.Fatalf("form start = %v, arrived %v", form["startedAt"], c.ticket.ArrivedAt)
	}

	// O atendente troca o órgão só para o chamado e corrige o início e o fim.
	newStart := c.ticket.ArrivedAt.Add(-30 * time.Minute).Truncate(time.Minute)
	newEnd := time.Now().Add(-time.Minute).Truncate(time.Minute)
	events := e.subscribe(c.supToken)
	resp = e.closeForm(c.ticket.ID, c.anaToken, with(with(c.form(other), "startedAt", newStart), "endedAt", newEnd))
	if resp.Status != http.StatusOK || resp.Body["status"] != "closed" {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	var (
		org, closedBy, assignee int64
		closureType, subject    string
		startedAt, endedAt      time.Time
		closedAt                time.Time
	)
	if err := e.Pool.QueryRow(t.Context(), `
		select organization_id, closed_by_id, assignee_id, closure_type::text, subject, started_at, ended_at, closed_at
		from tickets where id = $1`, c.ticket.ID).
		Scan(&org, &closedBy, &assignee, &closureType, &subject, &startedAt, &endedAt, &closedAt); err != nil {
		t.Fatal(err)
	}
	if org != other || closedBy != c.ana.ID || assignee != c.ana.ID || closureType != "resolved" || subject != "Contracheque" ||
		!startedAt.Equal(newStart) || !endedAt.Equal(newEnd) || closedAt.Before(newEnd) {
		t.Fatalf("closed ticket: org %d, by %d, type %s, subject %s, start %v, end %v, closed %v",
			org, closedBy, closureType, subject, startedAt, endedAt, closedAt)
	}
	// A troca de órgão vale só para o chamado.
	var contactOrg int64
	if err := e.Pool.QueryRow(t.Context(), "select organization_id from contacts where id = $1", c.ticket.ContactID).Scan(&contactOrg); err != nil {
		t.Fatal(err)
	}
	if contactOrg != c.org {
		t.Fatalf("contact organization changed to %d", contactOrg)
	}

	// Os módulos e os horários ficam no detalhe do chamado.
	recorded := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", c.ticket.ID), c.biaToken)
	if len(recorded) != 2 || recorded[0]["name"] != "Folha" || recorded[1]["name"] != "Patrimônio" {
		t.Fatalf("ticket modules = %v", recorded)
	}
	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil).Body
	if detail["status"] != "closed" || detail["subject"] != "Contracheque" || detail["resolution"] != "Enviada a segunda via." ||
		detail["organization"].(map[string]any)["name"] != "Câmara de Campinas" || detail["endedAt"] == nil {
		t.Fatalf("detail = %v", detail)
	}

	// A conversa mostra o encerramento, com quem encerrou.
	logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.biaToken)
	if len(logs) != 2 || logs[1]["action"] != "ticket_closed" || logs[1]["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("timeline = %v", logs)
	}

	// A auditoria registra o encerramento com os horários e o órgão alterados.
	actions, changes := c.ticketActions()
	if len(actions) != 3 || actions[1] != "ticket_organization_linked" || actions[2] != "ticket_closed" {
		t.Fatalf("audit actions = %v", actions)
	}
	closed := changes[2]
	// O cadastro do contato deu ao chamado o órgão principal; o encerramento o trocou.
	if closed["status"]["to"] != "closed" || closed["organization_id"]["from"] != float64(c.org) ||
		closed["organization_id"]["to"] != float64(other) || closed["subject"]["to"] != "Contracheque" {
		t.Fatalf("closing changes = %v", closed)
	}
	from, _ := time.Parse(time.RFC3339Nano, closed["started_at"]["from"].(string))
	to, _ := time.Parse(time.RFC3339Nano, closed["started_at"]["to"].(string))
	end, _ := time.Parse(time.RFC3339Nano, closed["ended_at"]["to"].(string))
	if !from.Equal(c.ticket.ArrivedAt) || !to.Equal(newStart) || !end.Equal(newEnd) {
		t.Fatalf("time changes = %v", closed)
	}
	if ids, _ := closed["module_ids"]["to"].([]any); len(ids) != 2 {
		t.Fatalf("module changes = %v", closed["module_ids"])
	}

	// Encerrado, ninguém responde nem encerra de novo.
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestA, "Mais alguma coisa?"); resp.Status != http.StatusConflict {
		t.Fatalf("send after closing: status %d", resp.Status)
	}
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusConflict {
		t.Fatalf("closing again: status %d", resp.Status)
	}
}

func TestCloseWithAutomaticTimes(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	before := time.Now()
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	var startedAt, endedAt time.Time
	if err := e.Pool.QueryRow(t.Context(), "select started_at, ended_at from tickets where id = $1", c.ticket.ID).
		Scan(&startedAt, &endedAt); err != nil {
		t.Fatal(err)
	}
	if !startedAt.Equal(c.ticket.ArrivedAt) || endedAt.Before(before.Add(-time.Second)) {
		t.Fatalf("start %v (arrived %v), end %v", startedAt, c.ticket.ArrivedAt, endedAt)
	}
	// Sem alteração, o início não aparece como alterado nem o órgão como trocado.
	_, changes := c.ticketActions()
	if _, ok := changes[2]["started_at"]; ok {
		t.Fatalf("unchanged start recorded: %v", changes[2])
	}
	if _, ok := changes[2]["organization_id"]; ok {
		t.Fatalf("unchanged organization recorded: %v", changes[2])
	}
}

func TestCloseRequiresTheCompleteForm(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	form := c.form(c.org)
	future := time.Now().Add(time.Hour)

	for name, body := range map[string]map[string]any{
		"no subject":                with(form, "subject", nil),
		"blank subject":             with(form, "subject", "   "),
		"no resolution":             with(form, "resolution", nil),
		"blank resolution":          with(form, "resolution", " "),
		"no modules":                with(form, "moduleIds", []int64{}),
		"inactive module":           with(form, "moduleIds", []int64{c.modules[0], c.inactive}),
		"module of another sector":  with(form, "moduleIds", []int64{c.rhModule}),
		"no organization":           with(form, "organizationId", nil),
		"unknown organization":      with(form, "organizationId", 999999),
		"end before start":          with(form, "endedAt", c.ticket.ArrivedAt.Add(-time.Hour)),
		"end in the future":         with(form, "endedAt", future),
		"start after automatic end": with(form, "startedAt", future),
	} {
		resp := e.closeForm(c.ticket.ID, c.anaToken, body)
		if resp.Status != http.StatusUnprocessableEntity {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" {
		t.Fatalf("ticket closed by an incomplete form: %+v", got)
	}
	if n := e.Count("ticket_modules"); n != 0 {
		t.Fatalf("ticket_modules rows = %d", n)
	}

	// Módulo repetido conta uma vez.
	resp := e.closeForm(c.ticket.ID, c.anaToken, with(form, "moduleIds", []int64{c.modules[0], c.modules[0]}))
	if resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.Count("ticket_modules"); n != 1 {
		t.Fatalf("ticket_modules rows = %d", n)
	}
}

func TestOnlyTheAssigneeCloses(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	for name, token := range map[string]string{
		"agent of the sector": c.biaToken, "supervisor": c.supToken, "admin": c.adminToken,
	} {
		if resp := e.closeForm(c.ticket.ID, token, c.form(c.org)); resp.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d", name, resp.Status)
		}
	}
	if resp := e.closeForm(c.ticket.ID, c.rhToken, c.form(c.org)); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.Status)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("closing form from another sector: status %d", status)
	}
	if resp := e.closeForm(c.ticket.ID, "", c.form(c.org)); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}

	// Chamado na fila não é encerrado: é assumido.
	queued := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.closeForm(queued.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.Status)
	}

	// Após a transferência, encerra o novo responsável, e o anterior não.
	bia := e.userID("bia@exemplo.com")
	if resp := e.transfer(c.ticket.ID, bia, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d", resp.Status)
	}
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusForbidden {
		t.Fatalf("previous assignee: status %d", resp.Status)
	}
	if resp := e.closeForm(c.ticket.ID, c.biaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("new assignee: status %d, body %v", resp.Status, resp.Body)
	}
	var closedBy int64
	if err := e.Pool.QueryRow(t.Context(), "select closed_by_id from tickets where id = $1", c.ticket.ID).Scan(&closedBy); err != nil {
		t.Fatal(err)
	}
	if closedBy != bia {
		t.Fatalf("closed by %d, want %d", closedBy, bia)
	}
}

func TestUnknownNumberMustBeRegisteredBeforeClosing(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e

	// Sem cadastro, o formulário não sugere órgão e o encerramento é recusado.
	form := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil).Body
	if form["organization"] != nil {
		t.Fatalf("organization suggested for an unknown number: %v", form["organization"])
	}
	resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org))
	if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Cadastre o contato e vincule-o a um órgão antes de encerrar." {
		t.Fatalf("unregistered contact: status %d, body %v", resp.Status, resp.Body)
	}
	if got := e.assignment(c.ticket.ID); got.Status != "in_progress" {
		t.Fatalf("ticket = %+v", got)
	}

	// Cadastrado e vinculado a um órgão, o formulário sugere esse órgão e o chamado encerra.
	c.register()
	form = e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID), c.anaToken, nil).Body
	if form["organization"] == nil || form["organization"].(map[string]any)["id"] != float64(c.org) {
		t.Fatalf("suggested organization = %v", form["organization"])
	}
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestMessageAfterClosingByTheFormOpensNewTicket(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}

	e.receive(c.sector.ID, text("MSG-9", "5511988887777@s.whatsapp.net", "5511988887777", "Outra dúvida"))
	tickets := e.tickets(c.sector.ID)
	if len(tickets) != 2 || tickets[0].ID != c.ticket.ID || tickets[0].Status != "closed" || tickets[1].Status != "queued" {
		t.Fatalf("tickets = %+v", tickets)
	}
	// O novo chamado já nasce com o órgão do contato cadastrado; o anterior fica no histórico.
	if tickets[1].OrganizationID == nil || *tickets[1].OrganizationID != c.org {
		t.Fatalf("new ticket organization = %v", tickets[1].OrganizationID)
	}
	if got := len(e.messages(c.ticket.ID)); got != 1 {
		t.Fatalf("messages of the closed ticket = %d", got)
	}
	history := e.DoList(http.MethodGet, fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID), c.anaToken)
	if len(history) != 2 || history[1]["status"] != "closed" || history[1]["subject"] != "Contracheque" {
		t.Fatalf("history = %v", history)
	}
}

func TestConcurrentClosingClosesOnce(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	const attempts = 5
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)).Status
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
	if n := e.Count("ticket_modules"); n != 2 {
		t.Fatalf("ticket_modules rows = %d", n)
	}
	if actions, _ := c.ticketActions(); len(actions) != 3 {
		t.Fatalf("audit actions = %v", actions)
	}
}

func TestRegisteringContactLinksOpenTicketsWithoutOrganization(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	if c.ticket.OrganizationID != nil {
		t.Fatalf("unknown number ticket born with organization %d", *c.ticket.OrganizationID)
	}
	events := e.subscribe(c.supToken)

	// O cadastro dá o órgão ao chamado aberto, com auditoria e aviso ao setor.
	c.register()
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}
	ticketOrg := func(id int64) *int64 {
		var org *int64
		if err := e.Pool.QueryRow(t.Context(), "select organization_id from tickets where id = $1", id).Scan(&org); err != nil {
			t.Fatal(err)
		}
		return org
	}
	if org := ticketOrg(c.ticket.ID); org == nil || *org != c.org {
		t.Fatalf("ticket organization = %v, want %d", org, c.org)
	}
	actions, changes := c.ticketActions()
	if len(actions) != 2 || actions[1] != "ticket_organization_linked" ||
		changes[1]["organization_id"]["from"] != nil || changes[1]["organization_id"]["to"] != float64(c.org) {
		t.Fatalf("audit = %v %v", actions, changes)
	}
	var actor int64
	if err := e.Pool.QueryRow(t.Context(),
		"select actor_id from audit_logs where ticket_id = $1 and action = 'ticket_organization_linked'", c.ticket.ID).Scan(&actor); err != nil {
		t.Fatal(err)
	}
	if actor != c.ana.ID {
		t.Fatalf("actor = %d", actor)
	}
	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.anaToken, nil).Body
	if detail["organization"] == nil || detail["organization"].(map[string]any)["id"] != float64(c.org) ||
		detail["organization"].(map[string]any)["municipality"].(map[string]any)["name"] != "Itu" {
		t.Fatalf("detail organization = %v", detail["organization"])
	}
	// O painel mostra o município ao lado do órgão.
	open := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/tickets", c.sector.ID), c.anaToken)
	if len(open) == 0 || open[0]["organizationName"] != "Prefeitura de Campinas" || open[0]["municipalityName"] != "Itu" {
		t.Fatalf("panel = %v", open)
	}

	// Chamado que já tem órgão não muda quando o cadastro troca o órgão principal.
	rh, err := e.Q.GetUserByEmail(t.Context(), "rh@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	e.receive(*rh.SectorID, text("RH-1", "5511988887777@s.whatsapp.net", "5511988887777", "Oi, RH"))
	rhTicket := e.tickets(*rh.SectorID)[0]
	if rhTicket.OrganizationID == nil || *rhTicket.OrganizationID != c.org {
		t.Fatalf("rh ticket organization = %v", rhTicket.OrganizationID)
	}
	other := e.Organization(c.supToken, "Câmara de Campinas", "")
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": other, "sectorIds": []int64{c.sector.ID}})
	if resp.Status != http.StatusOK {
		t.Fatalf("update contact: status %d, body %v", resp.Status, resp.Body)
	}
	if org := ticketOrg(c.ticket.ID); *org != c.org {
		t.Fatalf("ticket organization changed to %d", *org)
	}
	if org := ticketOrg(rhTicket.ID); *org != c.org {
		t.Fatalf("rh ticket organization changed to %d", *org)
	}
	if actions, _ := c.ticketActions(); len(actions) != 2 {
		t.Fatalf("audit actions = %v", actions)
	}

	// Cadastro inválido não grava nada.
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
		map[string]any{"name": "Maria", "phone": "5511988887777", "organizationId": 999999, "sectorIds": []int64{c.sector.ID}}); resp.Status == http.StatusOK {
		t.Fatalf("unknown organization accepted: %v", resp.Body)
	}
}

func TestRegisteringContactWhileClosingDoesNotDeadlock(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	c.register()

	// Encerramento e novo cadastro ao mesmo tempo travam na mesma ordem: os dois terminam.
	var wg sync.WaitGroup
	var closeStatus, registerStatus int
	wg.Go(func() { closeStatus = e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)).Status })
	wg.Go(func() {
		registerStatus = e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.anaToken,
			map[string]any{"name": "Maria Silva", "phone": "5511988887777", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}}).Status
	})
	wg.Wait()
	if closeStatus != http.StatusOK || registerStatus != http.StatusOK {
		t.Fatalf("close %d, register %d", closeStatus, registerStatus)
	}
}

// Os módulos do contato vêm marcados: só os ativos e do setor do chamado.
func TestClosingFormReturnsTheModulesOfTheContact(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	e := c.e
	path := fmt.Sprintf("/api/tickets/%d/closing-form", c.ticket.ID)
	marked := func() []any {
		t.Helper()
		resp := e.Do(http.MethodGet, path, c.anaToken, nil)
		if resp.Status != http.StatusOK {
			t.Fatalf("closing form: status %d", resp.Status)
		}
		list, ok := resp.Body["contactModuleIds"].([]any)
		if !ok {
			t.Fatalf("contactModuleIds: %v", resp.Body["contactModuleIds"])
		}
		return list
	}
	if got := marked(); len(got) != 0 {
		t.Fatalf("contact without modules: %v", got)
	}

	// O contato tem um módulo do setor, e um do RH, que o administrador marcou.
	var rhSector int64
	if err := e.Pool.QueryRow(t.Context(), "select sector_id from modules where id = $1", c.rhModule).Scan(&rhSector); err != nil {
		t.Fatal(err)
	}
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", c.ticket.ContactID), c.adminToken, map[string]any{
		"name": "Maria", "phone": "5511988887777", "organizationId": c.org,
		"sectorIds": []int64{c.sector.ID, rhSector}, "moduleIds": []int64{c.modules[0], c.rhModule},
	})
	if resp.Status != http.StatusOK {
		t.Fatalf("update contact: status %d, body %v", resp.Status, resp.Body)
	}
	if got := marked(); len(got) != 1 || int64(got[0].(float64)) != c.modules[0] {
		t.Fatalf("marked = %v, want only %d", got, c.modules[0])
	}

	// Desativado depois, o módulo deixa de vir marcado.
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/sectors/%d/modules/%d", c.sector.ID, c.modules[0]), c.supToken,
		map[string]any{"name": "Folha", "active": false}); resp.Status != http.StatusOK {
		t.Fatalf("deactivate: status %d", resp.Status)
	}
	if got := marked(); len(got) != 0 {
		t.Fatalf("inactive module marked: %v", got)
	}
}
