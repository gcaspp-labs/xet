package helpdesk_test

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// phone is a closing conversation whose contact, Maria, is registered and
// still has her WhatsApp ticket in progress with Ana, plus another registered
// contact, Carla, and the times of a call.
type phone struct {
	closing
	carla     int64
	startedAt time.Time
	endedAt   time.Time
}

func newPhone(t *testing.T) phone {
	t.Helper()
	c := phone{closing: newClosing(t)}
	c.register()
	c.carla = c.e.Contact(c.anaToken, "Carla Souza", "5513988881111", c.org, c.sector.ID)
	c.startedAt = time.Now().Add(-40 * time.Minute).Truncate(time.Second)
	c.endedAt = time.Now().Add(-25 * time.Minute).Truncate(time.Second)
	return c
}

func (c phone) phoneForm(contactID int64, requestID string) map[string]any {
	return map[string]any{
		"contactId": contactID, "organizationId": c.org, "moduleIds": c.modules,
		"subject": "Contracheque", "resolution": "Orientado por telefone.",
		"startedAt": c.startedAt, "endedAt": c.endedAt, "clientRequestId": requestID,
	}
}

func (e *testEnv) registerPhone(sectorID int64, token string, body map[string]any) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/phone-tickets", sectorID), token, body)
}

type phoneTicket struct {
	Status, Channel, ClosureType string
	SectorID, ContactID          int64
	OrganizationID               *int64
	AssigneeID, ClosedByID       *int64
	CreatedByID                  *int64
	ArrivedAt, StartedAt         time.Time
	AssignedAt, EndedAt          *time.Time
	ClosedAt                     *time.Time
	Subject, Resolution          *string
	ClientRequestID              pgtype.UUID
}

func (e *testEnv) phoneTicket(id int64) phoneTicket {
	e.T.Helper()
	var p phoneTicket
	err := e.Pool.QueryRow(e.T.Context(), `
		select status::text, channel::text, closure_type::text, sector_id, contact_id, organization_id,
		    assignee_id, closed_by_id, created_by_id, arrived_at, started_at, assigned_at, ended_at, closed_at,
		    subject, resolution, client_request_id
		from tickets where id = $1`, id).Scan(&p.Status, &p.Channel, &p.ClosureType, &p.SectorID, &p.ContactID, &p.OrganizationID,
		&p.AssigneeID, &p.ClosedByID, &p.CreatedByID, &p.ArrivedAt, &p.StartedAt, &p.AssignedAt, &p.EndedAt, &p.ClosedAt,
		&p.Subject, &p.Resolution, &p.ClientRequestID)
	if err != nil {
		e.T.Fatal(err)
	}
	return p
}

func (e *testEnv) phoneTicketCount() int {
	e.T.Helper()
	var n int
	if err := e.Pool.QueryRow(e.T.Context(), "select count(*) from tickets where channel = 'phone'").Scan(&n); err != nil {
		e.T.Fatal(err)
	}
	return n
}

func TestPhoneRegistrationCreatesAClosedTicket(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	events := e.subscribe(c.supToken)

	before := time.Now()
	resp := e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.carla, requestA))
	if resp.Status != http.StatusCreated {
		t.Fatalf("register: status %d, body %v", resp.Status, resp.Body)
	}
	id := int64(resp.Body["id"].(float64))

	// O protocolo é o seguinte da mesma sequência dos chamados.
	seq, err := strconv.Atoi(c.ticket.Protocol[5:])
	if err != nil {
		t.Fatal(err)
	}
	if want := fmt.Sprintf("%s%06d", c.ticket.Protocol[:5], seq+1); resp.Body["protocol"] != want {
		t.Fatalf("protocol = %v, want %s", resp.Body["protocol"], want)
	}

	p := e.phoneTicket(id)
	ana := c.ana.ID
	if p.Status != "closed" || p.Channel != "phone" || p.ClosureType != "resolved" || p.SectorID != c.sector.ID || p.ContactID != c.carla {
		t.Fatalf("ticket = %+v", p)
	}
	if p.AssigneeID == nil || *p.AssigneeID != ana || p.ClosedByID == nil || *p.ClosedByID != ana || p.CreatedByID != nil {
		t.Fatalf("people = assignee %v, closed by %v, created by %v", p.AssigneeID, p.ClosedByID, p.CreatedByID)
	}
	if !p.ArrivedAt.Equal(c.startedAt) || !p.StartedAt.Equal(c.startedAt) || p.AssignedAt == nil || !p.AssignedAt.Equal(c.startedAt) ||
		p.EndedAt == nil || !p.EndedAt.Equal(c.endedAt) {
		t.Fatalf("times = arrived %v, assigned %v, started %v, ended %v", p.ArrivedAt, p.AssignedAt, p.StartedAt, p.EndedAt)
	}
	if p.ClosedAt == nil || p.ClosedAt.Before(before.Add(-time.Second)) || p.ClosedAt.After(time.Now().Add(time.Second)) {
		t.Fatalf("closed at = %v", p.ClosedAt)
	}
	if p.OrganizationID == nil || *p.OrganizationID != c.org || str(p.Subject) != "Contracheque" || str(p.Resolution) != "Orientado por telefone." {
		t.Fatalf("closing data = %+v", p)
	}
	modules := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", id), c.anaToken)
	if len(modules) != len(c.modules) {
		t.Fatalf("modules = %v", modules)
	}
	if got := e.messages(id); len(got) != 0 {
		t.Fatalf("messages = %+v", got)
	}

	// A auditoria guarda quem registrou, quando e os dados.
	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "ticket", EntityID: id})
	if err != nil {
		t.Fatal(err)
	}
	if len(logs) != 1 || logs[0].Action != "ticket_phone_registered" || logs[0].ActorID == nil || *logs[0].ActorID != ana ||
		logs[0].CreatedAt.Before(before.Add(-time.Second)) {
		t.Fatalf("audit = %+v", logs)
	}
	_, changes := e.AuditChanges("ticket", id)
	for _, field := range []string{"status", "channel", "assignee_id", "subject", "resolution", "organization_id", "module_ids", "started_at", "ended_at"} {
		if _, ok := changes[0][field]; !ok {
			t.Fatalf("audit changes without %s: %v", field, changes[0])
		}
	}
	if changes[0]["channel"]["to"] != "phone" {
		t.Fatalf("audit channel = %v", changes[0]["channel"])
	}

	// As telas recebem o aviso do chamado, depois do commit.
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, id) {
		t.Fatalf("event = %+v", ev)
	}
}

func TestPhoneRegistrationFollowsTheClosingRules(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	unregistered := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666").ContactID
	modulesBefore := e.Count("ticket_modules")
	auditBefore := e.Count("audit_logs")
	ticketsBefore := e.Count("tickets")

	future := time.Now().Add(time.Hour)
	form := c.phoneForm(c.carla, requestA)
	for name, tc := range map[string]struct {
		body  map[string]any
		error string
	}{
		"without contact":        {with(form, "contactId", nil), "Escolha o contato."},
		"unknown contact":        {with(form, "contactId", 999999), "Contato não encontrado."},
		"unregistered contact":   {with(form, "contactId", unregistered), "Cadastre o contato e vincule-o a um órgão antes de registrar."},
		"without organization":   {with(form, "organizationId", nil), ""},
		"unknown organization":   {with(form, "organizationId", 999999), "Escolha um órgão cadastrado."},
		"without module":         {with(form, "moduleIds", []int64{}), ""},
		"inactive module":        {with(form, "moduleIds", []int64{c.modules[0], c.inactive}), "Escolha módulos ativos do setor do chamado."},
		"module of other sector": {with(form, "moduleIds", []int64{c.rhModule}), "Escolha módulos ativos do setor do chamado."},
		"without subject":        {with(form, "subject", "   "), "Preencha o assunto, a resolução e ao menos um módulo."},
		"without resolution":     {with(form, "resolution", "   "), "Preencha o assunto, a resolução e ao menos um módulo."},
		"end in the future":      {with(form, "endedAt", future), "O fim precisa ser depois do início e não pode estar no futuro."},
		"end before start":       {with(form, "endedAt", c.startedAt.Add(-time.Minute)), "O fim precisa ser depois do início e não pode estar no futuro."},
		"without start":          {with(form, "startedAt", nil), ""},
		"without end":            {with(form, "endedAt", nil), ""},
	} {
		resp := e.registerPhone(c.sector.ID, c.anaToken, tc.body)
		if resp.Status != http.StatusUnprocessableEntity || (tc.error != "" && resp.Body["error"] != tc.error) {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if e.Count("tickets") != ticketsBefore || e.Count("ticket_modules") != modulesBefore || e.Count("audit_logs") != auditBefore {
		t.Fatal("a refused registration recorded something")
	}
	// A chave da requisição recusada continua livre.
	if resp := e.registerPhone(c.sector.ID, c.anaToken, form); resp.Status != http.StatusCreated {
		t.Fatalf("valid after refusals: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestPhoneRegistrationAddsToTheListsAsTheClosing(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	body := c.phoneForm(c.carla, requestA)
	body["addSubject"], body["subjectModuleId"] = true, c.modules[0]
	body["addSolution"], body["solutionModuleId"] = true, c.modules[0]
	if resp := e.registerPhone(c.sector.ID, c.anaToken, body); resp.Status != http.StatusCreated {
		t.Fatalf("register: status %d, body %v", resp.Status, resp.Body)
	}
	subject := e.subjectID(c.sector.ID, "Contracheque")
	if got := e.solutionBodies(subject); len(got) != 1 || got[0] != "Orientado por telefone." {
		t.Fatalf("solutions = %v", got)
	}
}

func TestPhoneRegistrationPermissions(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	rh, err := e.Q.GetUserByEmail(t.Context(), "rh@exemplo.com")
	if err != nil {
		t.Fatal(err)
	}
	rhSector := *rh.SectorID

	// Atendente e supervisor só registram no próprio setor.
	if resp := e.registerPhone(c.sector.ID, c.rhToken, c.phoneForm(c.carla, requestA)); resp.Status != http.StatusForbidden {
		t.Fatalf("agent of other sector: status %d", resp.Status)
	}
	rhForm := with(c.phoneForm(c.carla, requestB), "moduleIds", []int64{c.rhModule})
	if resp := e.registerPhone(rhSector, c.supToken, rhForm); resp.Status != http.StatusForbidden {
		t.Fatalf("supervisor in other sector: status %d", resp.Status)
	}
	if resp := e.registerPhone(c.sector.ID, "", c.phoneForm(c.carla, requestA)); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	if n := e.phoneTicketCount(); n != 0 {
		t.Fatalf("refused registrations created %d", n)
	}

	// O supervisor registra no próprio setor e o administrador em qualquer setor ativo.
	if resp := e.registerPhone(c.sector.ID, c.supToken, c.phoneForm(c.carla, requestA)); resp.Status != http.StatusCreated {
		t.Fatalf("supervisor: status %d, body %v", resp.Status, resp.Body)
	}
	resp := e.registerPhone(rhSector, c.adminToken, rhForm)
	if resp.Status != http.StatusCreated {
		t.Fatalf("admin in RH: status %d, body %v", resp.Status, resp.Body)
	}
	if p := e.phoneTicket(int64(resp.Body["id"].(float64))); p.SectorID != rhSector {
		t.Fatalf("admin registration sector = %d", p.SectorID)
	}
	if _, err := e.Pool.Exec(t.Context(), "update sectors set active = false where id = $1", rhSector); err != nil {
		t.Fatal(err)
	}
	if resp := e.registerPhone(rhSector, c.adminToken, with(rhForm, "clientRequestId", requestC)); resp.Status != http.StatusNotFound {
		t.Fatalf("admin in inactive sector: status %d", resp.Status)
	}
}

func TestPhoneRegistrationNeedsNoNumberAndKeepsTheOpenTicket(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	if err := e.WhatsApp.Drop(t.Context(), c.sector.ID); err != nil {
		t.Fatal(err)
	}
	before := e.assignment(c.ticket.ID)

	// Maria tem chamado em atendimento no WhatsApp no setor; a ligação é outro atendimento.
	resp := e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.ticket.ContactID, requestA))
	if resp.Status != http.StatusCreated {
		t.Fatalf("register: status %d, body %v", resp.Status, resp.Body)
	}
	if sent := e.WhatsApp.SentMessages(); len(sent) != 0 {
		t.Fatalf("sent to WhatsApp = %+v", sent)
	}
	after := e.assignment(c.ticket.ID)
	if after.Status != "in_progress" || after.Status != before.Status || *after.AssigneeID != *before.AssigneeID {
		t.Fatalf("open ticket before %+v, after %+v", before, after)
	}
	if resp := e.sendText(c.ticket.ID, c.anaToken, requestB, "Ainda aqui"); resp.Status != http.StatusOK {
		t.Fatalf("open ticket still conducted: status %d", resp.Status)
	}
}

func TestPhoneRegistrationIsIdempotent(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e

	// Cliques repetidos e simultâneos com o mesmo identificador criam um único registro.
	const attempts = 8
	responses := make([]response, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			responses[i] = e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.carla, requestA))
		})
	}
	wg.Wait()
	id := responses[0].Body["id"]
	for i, resp := range responses {
		if resp.Status != http.StatusCreated || resp.Body["id"] != id || resp.Body["protocol"] != responses[0].Body["protocol"] {
			t.Fatalf("attempt %d: status %d, body %v", i, resp.Status, resp.Body)
		}
	}
	if n := e.phoneTicketCount(); n != 1 {
		t.Fatalf("phone tickets = %d", n)
	}
	if actions, _ := e.AuditChanges("ticket", int64(id.(float64))); len(actions) != 1 {
		t.Fatalf("audit = %v", actions)
	}
	if resp := e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.carla, requestA)); resp.Status != http.StatusCreated || resp.Body["id"] != id {
		t.Fatalf("later repetition: status %d, body %v", resp.Status, resp.Body)
	}

	// O mesmo identificador usado por outra pessoa é recusado.
	resp := e.registerPhone(c.sector.ID, c.biaToken, c.phoneForm(c.carla, requestA))
	if resp.Status != http.StatusConflict {
		t.Fatalf("other author: status %d, body %v", resp.Status, resp.Body)
	}
	if n := e.phoneTicketCount(); n != 1 {
		t.Fatalf("phone tickets after conflict = %d", n)
	}
}

func TestReadingsBringTheChannel(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	// O chamado do WhatsApp de Maria é encerrado; depois, ela liga.
	if resp := e.closeForm(c.ticket.ID, c.anaToken, c.form(c.org)); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	resp := e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.ticket.ContactID, requestA))
	if resp.Status != http.StatusCreated {
		t.Fatalf("register: status %d, body %v", resp.Status, resp.Body)
	}
	phoneID := resp.Body["id"].(float64)
	want := map[float64]string{float64(c.ticket.ID): "whatsapp", phoneID: "phone"}

	check := func(where string, items []map[string]any) {
		t.Helper()
		got := map[float64]string{}
		for _, item := range items {
			got[item["id"].(float64)], _ = item["channel"].(string)
		}
		for id, channel := range want {
			if got[id] != channel {
				t.Fatalf("%s: ticket %v channel %q, want %q (items %v)", where, id, got[id], channel, items)
			}
		}
	}
	check("closed tickets", e.DoPageItems("/api/closed-tickets", c.supToken))
	check("contact history", e.DoPageItems(fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID), c.anaToken))
	check("organization history", e.DoPageItems(fmt.Sprintf("/api/organizations/%d/tickets", c.org), c.anaToken))
	for id, channel := range want {
		detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", int64(id)), c.anaToken, nil)
		if detail.Status != http.StatusOK || detail.Body["channel"] != channel {
			t.Fatalf("detail %v: status %d, channel %v", id, detail.Status, detail.Body["channel"])
		}
	}
}

func TestPhoneRegistrationIsCorrectedAsAnyClosedTicket(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	resp := e.registerPhone(c.sector.ID, c.anaToken, c.phoneForm(c.carla, requestA))
	if resp.Status != http.StatusCreated {
		t.Fatalf("register: status %d, body %v", resp.Status, resp.Body)
	}
	id := int64(resp.Body["id"].(float64))
	correction := func(subject string) map[string]any {
		return map[string]any{
			"subject": subject, "resolution": "Orientado por telefone.",
			"moduleIds": c.modules, "organizationId": c.org,
			"startedAt": c.startedAt, "endedAt": c.endedAt, "reason": "Assunto errado.",
		}
	}

	// Outro atendente do setor é recusado.
	if resp := e.correct(id, c.biaToken, correction("Pela Bia")); resp.Status != http.StatusForbidden {
		t.Fatalf("other agent: status %d, body %v", resp.Status, resp.Body)
	}
	// Quem registrou e o supervisor do setor corrigem.
	for name, token := range map[string]string{"registrar": c.anaToken, "supervisor": c.supToken} {
		if resp := e.correct(id, token, correction("Por "+name)); resp.Status != http.StatusOK {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	actions, _ := e.AuditChanges("ticket", id)
	if strings.Join(actions, ",") != "ticket_phone_registered,ticket_corrected,ticket_corrected" {
		t.Fatalf("audit = %v", actions)
	}
	if p := e.phoneTicket(id); p.Channel != "phone" || p.Status != "closed" {
		t.Fatalf("after correction = %+v", p)
	}
}

func (e *testEnv) phoneFormFor(sectorID, contactID int64, token string) response {
	e.T.Helper()
	return e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/phone-tickets/form?contactId=%d", sectorID, contactID), token, nil)
}

// contactWithModule creates a contact registered in the sector with one of its
// modules.
func (e *testEnv) contactWithModule(token, name, phone string, orgID, sectorID, moduleID int64) int64 {
	e.T.Helper()
	resp := e.Do(http.MethodPost, "/api/contacts", token, map[string]any{
		"name": name, "phone": phone, "organizationId": orgID,
		"sectorIds": []int64{sectorID}, "moduleIds": []int64{moduleID},
	})
	if resp.Status != http.StatusCreated {
		e.T.Fatalf("create contact %s: status %d, body %v", name, resp.Status, resp.Body)
	}
	return id(resp.Body)
}

func TestPhoneFormReturnsTheSectorDefaults(t *testing.T) {
	t.Parallel()
	c := newPhone(t)
	e := c.e
	subject := e.createSubject(c.sector.ID, c.supToken, "Contracheque")
	contact := e.contactWithModule(c.supToken, "Fernanda Lima", "5513977772222", c.org, c.sector.ID, c.modules[0])

	// O formulário começa com os módulos ativos do setor, o assunto na lista, o
	// módulo do contato entre os ativos do setor e o órgão principal do contato.
	resp := e.phoneFormFor(c.sector.ID, contact, c.anaToken)
	if resp.Status != http.StatusOK {
		t.Fatalf("phone form: status %d, body %v", resp.Status, resp.Body)
	}
	modules, _ := resp.Body["modules"].([]any)
	if len(modules) != 2 || modules[0].(map[string]any)["name"] != "Folha" {
		t.Fatalf("form modules = %v", resp.Body["modules"])
	}
	subjects, _ := resp.Body["subjects"].([]any)
	if len(subjects) != 1 || subjects[0].(map[string]any)["name"] != "Contracheque" ||
		subjects[0].(map[string]any)["moduleId"] != float64(c.modules[0]) {
		t.Fatalf("form subjects = %v", resp.Body["subjects"])
	}
	contactModules, _ := resp.Body["contactModuleIds"].([]any)
	if len(contactModules) != 1 || contactModules[0] != float64(c.modules[0]) {
		t.Fatalf("form contact modules = %v", resp.Body["contactModuleIds"])
	}
	if org := resp.Body["organization"].(map[string]any); org["id"] != float64(c.org) || org["municipality"].(map[string]any)["name"] != "Itu" {
		t.Fatalf("form organization = %v", resp.Body["organization"])
	}
	if _, err := time.Parse(time.RFC3339Nano, resp.Body["startedAt"].(string)); err != nil {
		t.Fatalf("form start = %v", resp.Body["startedAt"])
	}
	if subject == 0 {
		t.Fatal("subject was not created")
	}

	// O atendente de outro setor é recusado; o administrador lê qualquer setor ativo.
	if resp := e.phoneFormFor(c.sector.ID, contact, c.rhToken); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.phoneFormFor(c.sector.ID, contact, c.adminToken); resp.Status != http.StatusOK {
		t.Fatalf("admin: status %d, body %v", resp.Status, resp.Body)
	}
	// Contato desconhecido e contato faltando são recusados.
	if resp := e.phoneFormFor(c.sector.ID, 999999, c.anaToken); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("unknown contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodGet, fmt.Sprintf("/api/sectors/%d/phone-tickets/form", c.sector.ID), c.anaToken, nil); resp.Status != http.StatusBadRequest {
		t.Fatalf("no contact: status %d, body %v", resp.Status, resp.Body)
	}
}
