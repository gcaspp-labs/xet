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

// correction is a ticket closed by Ana with the closing form, with the times
// it was closed with.
type correction struct {
	closing
	startedAt time.Time
	endedAt   time.Time
}

func newCorrection(t *testing.T) correction {
	t.Helper()
	c := correction{closing: newClosing(t)}
	c.register()
	c.startedAt = c.ticket.ArrivedAt.Add(-30 * time.Minute).Truncate(time.Minute)
	c.endedAt = time.Now().Add(-10 * time.Minute).Truncate(time.Minute)
	form := with(with(c.form(c.org), "startedAt", c.startedAt), "endedAt", c.endedAt)
	if resp := c.e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
	return c
}

// data is the closing data as recorded, ready to be changed and sent as a
// correction with the reason.
func (c correction) data(reason string) map[string]any {
	return map[string]any{
		"subject": "Contracheque", "resolution": "Enviada a segunda via.",
		"moduleIds": c.modules, "organizationId": c.org,
		"startedAt": c.startedAt, "endedAt": c.endedAt, "spokeWith": "", "reason": reason,
	}
}

func (e *testEnv) correct(ticketID int64, token string, body map[string]any) response {
	e.T.Helper()
	return e.Do(http.MethodPost, fmt.Sprintf("/api/tickets/%d/correct", ticketID), token, body)
}

func TestCorrectionRecordsAuthorReasonAndChanges(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	other := e.Organization(c.supToken, "Câmara de Campinas", "")
	newStart := c.startedAt.Add(15 * time.Minute)
	newEnd := c.endedAt.Add(-5 * time.Minute)

	events := e.subscribe(c.biaToken)
	body := c.data("Assunto e horários registrados errados.")
	body["subject"] = "Segunda via do contracheque"
	body["organizationId"] = other
	body["moduleIds"] = []int64{c.modules[1]}
	body["startedAt"] = newStart
	body["endedAt"] = newEnd
	body["spokeWith"] = "Maria, esposa"
	resp := e.correct(c.ticket.ID, c.anaToken, body)
	if resp.Status != http.StatusOK || resp.Body["status"] != "closed" {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	if ev := e.nextEvent(events); ev != realtime.TicketChanged(c.sector.ID, c.ticket.ID) {
		t.Fatalf("event = %+v", ev)
	}

	// Os dados corrigidos substituem os do encerramento; o chamado continua encerrado por Ana.
	detail := e.Do(http.MethodGet, fmt.Sprintf("/api/tickets/%d", c.ticket.ID), c.biaToken, nil).Body
	if detail["subject"] != "Segunda via do contracheque" || detail["resolution"] != "Enviada a segunda via." ||
		detail["organization"].(map[string]any)["name"] != "Câmara de Campinas" || detail["spokeWith"] != "Maria, esposa" ||
		detail["closedBy"].(map[string]any)["id"] != float64(c.ana.ID) {
		t.Fatalf("detail = %v", detail)
	}
	var startedAt, endedAt time.Time
	if err := e.Pool.QueryRow(t.Context(), "select started_at, ended_at from tickets where id = $1", c.ticket.ID).
		Scan(&startedAt, &endedAt); err != nil {
		t.Fatal(err)
	}
	if !startedAt.Equal(newStart) || !endedAt.Equal(newEnd) {
		t.Fatalf("start %v, end %v", startedAt, endedAt)
	}
	modules := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", c.ticket.ID), c.biaToken)
	if len(modules) != 1 || modules[0]["name"] != "Patrimônio" {
		t.Fatalf("modules = %v", modules)
	}

	// A auditoria guarda quem corrigiu, o motivo e os valores anteriores e novos só dos campos alterados.
	var (
		actor  int64
		reason string
	)
	if err := e.Pool.QueryRow(t.Context(), `
		select actor_id, reason from audit_logs where ticket_id = $1 and action = 'ticket_corrected'`, c.ticket.ID).
		Scan(&actor, &reason); err != nil {
		t.Fatal(err)
	}
	if actor != c.ana.ID || reason != "Assunto e horários registrados errados." {
		t.Fatalf("audit actor %d, reason %q", actor, reason)
	}
	actions, changes := c.ticketActions()
	last := changes[len(changes)-1]
	if actions[len(actions)-1] != "ticket_corrected" || len(last) != 6 {
		t.Fatalf("audit = %v, %v", actions, last)
	}
	if _, ok := last["resolution"]; ok {
		t.Fatalf("unchanged resolution recorded: %v", last)
	}
	if last["subject"]["from"] != "Contracheque" || last["subject"]["to"] != "Segunda via do contracheque" ||
		last["organization_id"]["from"] != float64(c.org) || last["organization_id"]["to"] != float64(other) ||
		last["spoke_with"]["from"] != nil || last["spoke_with"]["to"] != "Maria, esposa" {
		t.Fatalf("changes = %v", last)
	}
	if from, _ := last["module_ids"]["from"].([]any); len(from) != 2 {
		t.Fatalf("module changes = %v", last["module_ids"])
	}

	// O histórico de alterações mostra a correção com nomes, e a conversa mostra quem corrigiu.
	history := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/corrections", c.ticket.ID), c.biaToken)
	if len(history) != 1 || history[0]["reason"] != "Assunto e horários registrados errados." ||
		history[0]["actor"].(map[string]any)["name"] != "ana@exemplo.com" || history[0]["createdAt"] == nil {
		t.Fatalf("history = %v", history)
	}
	fields := map[string]map[string]any{}
	for _, ch := range history[0]["changes"].([]any) {
		m := ch.(map[string]any)
		fields[m["field"].(string)] = m
	}
	if len(fields) != 6 || fields["organization"]["from"] != "Prefeitura de Campinas — Itu" || fields["organization"]["to"] != "Câmara de Campinas — Itu" {
		t.Fatalf("history changes = %v", fields)
	}
	if from, to := fields["modules"]["from"].([]any), fields["modules"]["to"].([]any); len(from) != 2 || from[0] != "Folha" || len(to) != 1 || to[0] != "Patrimônio" {
		t.Fatalf("module history = %v", fields["modules"])
	}
	if from, _ := time.Parse(time.RFC3339Nano, fields["started_at"]["from"].(string)); !from.Equal(c.startedAt) {
		t.Fatalf("start history = %v", fields["started_at"])
	}
	logs := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/assignments", c.ticket.ID), c.biaToken)
	if l := logs[len(logs)-1]; l["action"] != "ticket_corrected" || l["actor"].(map[string]any)["name"] != "ana@exemplo.com" {
		t.Fatalf("timeline = %v", logs)
	}
	if status, _, _ := e.get(fmt.Sprintf("/api/tickets/%d/corrections", c.ticket.ID), c.rhToken); status != http.StatusForbidden {
		t.Fatalf("history from another sector: status %d", status)
	}
}

func TestCorrectionWithoutReasonIsRefused(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e

	for name, reason := range map[string]any{"no reason": nil, "empty": "", "blank": "   "} {
		body := with(c.data("x"), "reason", reason)
		body["subject"] = "Outro assunto"
		resp := e.correct(c.ticket.ID, c.anaToken, body)
		if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Informe o motivo da correção." {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	var subject string
	if err := e.Pool.QueryRow(t.Context(), "select subject from tickets where id = $1", c.ticket.ID).Scan(&subject); err != nil {
		t.Fatal(err)
	}
	if subject != "Contracheque" {
		t.Fatalf("subject changed to %q", subject)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] != "ticket_closed" {
		t.Fatalf("audit actions = %v", actions)
	}

	// O banco também recusa correção sem motivo.
	_, err := e.Pool.Exec(t.Context(), `
		insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, changes)
		values ($1, 'ticket', $1, 'ticket_corrected', $2, '{}')`, c.ticket.ID, c.ana.ID)
	if err == nil {
		t.Fatal("correction without reason accepted by the database")
	}
}

func TestOnlyWhoClosedAndSupervisionCorrect(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e

	// O atendente do setor que não encerrou é bloqueado, mesmo chamando a API diretamente.
	body := c.data("Assunto errado.")
	body["subject"] = "Pela Bia"
	resp := e.correct(c.ticket.ID, c.biaToken, body)
	if resp.Status != http.StatusForbidden || resp.Body["error"] != "Apenas quem encerrou o atendimento e a supervisão do setor podem corrigi-lo." {
		t.Fatalf("agent who did not close: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.correct(c.ticket.ID, c.rhToken, body); resp.Status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", resp.Status)
	}
	if resp := e.correct(c.ticket.ID, "", body); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] != "ticket_closed" {
		t.Fatalf("blocked correction recorded: %v", actions)
	}

	// Quem encerrou, o supervisor do setor e o administrador corrigem.
	for name, token := range map[string]string{"closer": c.anaToken, "supervisor": c.supToken, "admin": c.adminToken} {
		body := c.data("Assunto errado.")
		body["subject"] = "Por " + name
		if resp := e.correct(c.ticket.ID, token, body); resp.Status != http.StatusOK {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	if actions, _ := c.ticketActions(); len(actions) != 6 {
		t.Fatalf("audit actions = %v", actions)
	}

	// Chamado aberto não é corrigido: o responsável altera pelo encerramento.
	queued := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.correct(queued.ID, c.supToken, c.data("Assunto errado.")); resp.Status != http.StatusConflict {
		t.Fatalf("queued ticket: status %d", resp.Status)
	}
	if resp := e.assign(queued.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.correct(queued.ID, c.anaToken, c.data("Assunto errado.")); resp.Status != http.StatusConflict {
		t.Fatalf("ticket in progress: status %d", resp.Status)
	}
}

func TestCorrectionFollowsTheClosingRules(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e
	base := c.data("Ajuste.")

	for name, body := range map[string]map[string]any{
		"blank subject":            with(base, "subject", " "),
		"blank resolution":         with(base, "resolution", " "),
		"no modules":               with(base, "moduleIds", []int64{}),
		"new inactive module":      with(base, "moduleIds", []int64{c.modules[0], c.inactive}),
		"module of another sector": with(base, "moduleIds", []int64{c.modules[0], c.rhModule}),
		"unknown organization":     with(base, "organizationId", 999999),
		"no start":                 with(base, "startedAt", nil),
		"end before start":         with(base, "endedAt", c.startedAt.Add(-time.Minute)),
		"end in the future":        with(base, "endedAt", time.Now().Add(time.Hour)),
	} {
		if resp := e.correct(c.ticket.ID, c.anaToken, body); resp.Status != http.StatusUnprocessableEntity {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}

	// Sem nenhuma alteração, a correção é recusada e nada é gravado.
	resp := e.correct(c.ticket.ID, c.anaToken, with(base, "subject", "  Contracheque "))
	if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != "Nenhum dado foi alterado." {
		t.Fatalf("no changes: status %d, body %v", resp.Status, resp.Body)
	}
	if actions, _ := c.ticketActions(); actions[len(actions)-1] != "ticket_closed" {
		t.Fatalf("audit actions = %v", actions)
	}
	if n := e.Count("ticket_modules"); n != 2 {
		t.Fatalf("ticket_modules rows = %d", n)
	}

	// Um módulo desativado depois do encerramento continua no chamado ao corrigir outro dado.
	if _, err := e.Q.UpdateModule(t.Context(), db.UpdateModuleParams{ID: c.modules[0], Name: "Folha", Active: false}); err != nil {
		t.Fatal(err)
	}
	if resp := e.correct(c.ticket.ID, c.anaToken, with(base, "resolution", "Enviada por e-mail.")); resp.Status != http.StatusOK {
		t.Fatalf("keeping a deactivated module: status %d, body %v", resp.Status, resp.Body)
	}
	if modules := e.DoList(http.MethodGet, fmt.Sprintf("/api/tickets/%d/modules", c.ticket.ID), c.anaToken); len(modules) != 2 {
		t.Fatalf("modules = %v", modules)
	}
}

func TestConcurrentCorrectionsChainTheirChanges(t *testing.T) {
	t.Parallel()
	c := newCorrection(t)
	e := c.e

	const attempts = 5
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			body := c.data("Assunto errado.")
			body["subject"] = fmt.Sprintf("Assunto %d", i)
			statuses[i] = e.correct(c.ticket.ID, c.supToken, body).Status
		})
	}
	wg.Wait()
	for _, s := range statuses {
		if s != http.StatusOK {
			t.Fatalf("statuses = %v", statuses)
		}
	}

	// Cada correção parte do valor deixado pela anterior: nenhuma se perde.
	actions, changes := c.ticketActions()
	corrections := changes[len(changes)-attempts:]
	if len(actions) != 3+attempts {
		t.Fatalf("audit actions = %v", actions)
	}
	prev := "Contracheque"
	for _, ch := range corrections {
		if ch["subject"]["from"] != prev {
			t.Fatalf("corrections = %v", corrections)
		}
		prev = ch["subject"]["to"].(string)
	}
	var subject string
	if err := e.Pool.QueryRow(t.Context(), "select subject from tickets where id = $1", c.ticket.ID).Scan(&subject); err != nil {
		t.Fatal(err)
	}
	if subject != prev {
		t.Fatalf("subject %q, last correction %q", subject, prev)
	}
}
