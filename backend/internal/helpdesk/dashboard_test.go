package helpdesk_test

import (
	"fmt"
	"net/http"
	"net/url"
	"reflect"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// notApplicable stands for a number the active filter does not apply to, and
// nil for an average without data.
const notApplicable = "não se aplica"

var (
	dashboardZone = mustZone("America/Sao_Paulo")
	// dashboardDay is the day of the tests that fix the times of the tickets.
	dashboardDay   = time.Date(2026, 3, 10, 0, 0, 0, 0, dashboardZone)
	dashboardNoon  = dashboardDay.Add(12 * time.Hour)
	dashboardQuery = url.Values{"from": {"2026-03-10"}, "to": {"2026-03-10"}}
)

func mustZone(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

type dashboardFixture struct {
	e                               *testEnv
	contab, rh                      db.Sector
	ana, bia, sup, admin, rhUser    db.User
	anaToken, biaToken, supToken    string
	adminToken, rhToken, rhSupToken string
	orgA, orgB                      int64
	modA, modB, rhMod               int64
	nextID                          int
}

func newDashboard(t *testing.T) *dashboardFixture {
	t.Helper()
	e := newTestEnv(t, nil)
	d := &dashboardFixture{e: e, contab: e.Sector("Contabilidade"), rh: e.Sector("RH")}
	d.ana = e.User("ana@exemplo.com", db.UserRoleAgent, &d.contab.ID)
	d.bia = e.User("bia@exemplo.com", db.UserRoleAgent, &d.contab.ID)
	d.sup = e.User("sup@exemplo.com", db.UserRoleSupervisor, &d.contab.ID)
	d.admin = e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	d.rhUser = e.User("rh@exemplo.com", db.UserRoleAgent, &d.rh.ID)
	e.User("rhsup@exemplo.com", db.UserRoleSupervisor, &d.rh.ID)
	d.anaToken = e.Login("ana@exemplo.com", testPassword)
	d.biaToken = e.Login("bia@exemplo.com", testPassword)
	d.supToken = e.Login("sup@exemplo.com", testPassword)
	d.adminToken = e.Login("admin@exemplo.com", testPassword)
	d.rhToken = e.Login("rh@exemplo.com", testPassword)
	d.rhSupToken = e.Login("rhsup@exemplo.com", testPassword)
	e.connectSector(d.contab.ID)
	e.connectSector(d.rh.ID)
	d.orgA = e.Organization(d.supToken, "Prefeitura A", "")
	d.orgB = e.Organization(d.supToken, "Prefeitura B", "")
	d.modA = d.module(d.contab.ID, "Folha")
	d.modB = d.module(d.contab.ID, "Patrimônio")
	d.rhMod = d.module(d.rh.ID, "Ponto")
	return d
}

func (d *dashboardFixture) module(sectorID int64, name string) int64 {
	d.e.T.Helper()
	m, err := d.e.Q.CreateModule(d.e.T.Context(), db.CreateModuleParams{SectorID: sectorID, Name: name})
	if err != nil {
		d.e.T.Fatal(err)
	}
	return m.ID
}

func (d *dashboardFixture) next() int {
	d.nextID++
	return d.nextID
}

func (d *dashboardFixture) phone(n int) string {
	return fmt.Sprintf("55119%08d", n)
}

// contact registers a contact of the organization and returns it with its phone.
func (d *dashboardFixture) contact(org int64) (int64, string) {
	d.e.T.Helper()
	n := d.next()
	phone := d.phone(n)
	return d.e.Contact(d.supToken, fmt.Sprintf("Contato %d", n), phone, org, d.contab.ID), phone
}

// received is a queued ticket opened by a message of a registered contact.
func (d *dashboardFixture) received(sectorID, org int64) ticketRow {
	d.e.T.Helper()
	_, phone := d.contact(org)
	return d.e.queuedTicket(sectorID, fmt.Sprintf("IN-%d", d.next()), phone)
}

// assigned is a received ticket in progress with the token's user.
func (d *dashboardFixture) assigned(sectorID, org int64, token string) ticketRow {
	d.e.T.Helper()
	t := d.received(sectorID, org)
	if resp := d.e.assign(t.ID, token); resp.Status != http.StatusOK {
		d.e.T.Fatalf("assign: status %d, body %v", resp.Status, resp.Body)
	}
	return t
}

// phoneTicket is a queued ticket opened by a message sent from the phone.
func (d *dashboardFixture) phoneTicket(sectorID, org int64) ticketRow {
	d.e.T.Helper()
	contact, phone := d.contact(org)
	d.e.sendOutside(sectorID, text(fmt.Sprintf("OUT-%d", d.next()), phone+"@s.whatsapp.net", phone, "Bom dia"))
	return d.openTicket(sectorID, contact)
}

func (d *dashboardFixture) openTicket(sectorID, contact int64) ticketRow {
	d.e.T.Helper()
	for _, t := range d.e.tickets(sectorID) {
		if t.ContactID == contact && t.Status != "closed" {
			return t
		}
	}
	d.e.T.Fatalf("no open ticket for contact %d", contact)
	return ticketRow{}
}

// started is a conversation started in the system by the token's user.
func (d *dashboardFixture) started(sectorID, org int64, token string) ticketRow {
	d.e.T.Helper()
	contact, _ := d.contact(org)
	request := fmt.Sprintf("8b3d8f50-3f2c-4b7d-9e30-%012d", d.next())
	if resp := d.e.startConversation(sectorID, contact, token, request, "Olá"); resp.Status >= 300 {
		d.e.T.Fatalf("start: status %d, body %v", resp.Status, resp.Body)
	}
	return d.openTicket(sectorID, contact)
}

func (d *dashboardFixture) form(org int64, modules ...int64) map[string]any {
	return map[string]any{"subject": "Dúvida", "resolution": "Resolvida.", "moduleIds": modules, "organizationId": org}
}

func (d *dashboardFixture) close(ticketID int64, token string, form map[string]any) {
	d.e.T.Helper()
	if resp := d.e.closeForm(ticketID, token, form); resp.Status != http.StatusOK {
		d.e.T.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}
}

// resolved is a received ticket closed by the form by the token's user.
func (d *dashboardFixture) resolved(org int64, token string, modules ...int64) ticketRow {
	d.e.T.Helper()
	t := d.assigned(d.contab.ID, org, token)
	d.close(t.ID, token, d.form(org, modules...))
	return t
}

// transferred is a received ticket moved to RH, and the ticket at the destination.
func (d *dashboardFixture) transferred(org int64, token string, modules ...int64) (origin, destination ticketRow) {
	d.e.T.Helper()
	origin = d.assigned(d.contab.ID, org, token)
	form := with(d.form(org, modules...), "sectorId", d.rh.ID)
	if resp := d.e.transferSector(origin.ID, token, form); resp.Status != http.StatusOK {
		d.e.T.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	return origin, d.openTicket(d.rh.ID, origin.ContactID)
}

func (d *dashboardFixture) cancel(ticketID int64, token string) {
	d.e.T.Helper()
	if resp := d.e.cancel(ticketID, token, "Engano"); resp.Status != http.StatusOK {
		d.e.T.Fatalf("cancel: status %d, body %v", resp.Status, resp.Body)
	}
}

// ticketTimes moves the moments of a ticket, which the API takes from the clock.
type ticketTimes struct {
	arrived, assigned, ended, closed *time.Time
}

func (d *dashboardFixture) setTimes(ticketID int64, times ticketTimes) {
	d.e.T.Helper()
	_, err := d.e.Pool.Exec(d.e.T.Context(), `
		update tickets set
			arrived_at = coalesce($2, arrived_at),
			started_at = coalesce($2, started_at),
			assigned_at = coalesce($3, assigned_at),
			ended_at = coalesce($4, ended_at),
			closed_at = coalesce($5, closed_at)
		where id = $1`, ticketID, times.arrived, times.assigned, times.ended, times.closed)
	if err != nil {
		d.e.T.Fatal(err)
	}
}

// timed moves a ticket to the day of the tests: it arrives at noon, is assumed
// wait seconds later and ends handling seconds after that. A negative wait
// leaves the ticket unassigned and a negative handling leaves it open.
func (d *dashboardFixture) timed(ticketID int64, wait, handling int) {
	d.e.T.Helper()
	times := ticketTimes{arrived: &dashboardNoon}
	if wait >= 0 {
		assigned := dashboardNoon.Add(time.Duration(wait) * time.Second)
		times.assigned = &assigned
		if handling >= 0 {
			ended := assigned.Add(time.Duration(handling) * time.Second)
			times.ended, times.closed = &ended, &ended
		}
	}
	d.setTimes(ticketID, times)
}

func (d *dashboardFixture) get(token string, query url.Values) response {
	d.e.T.Helper()
	return d.e.Do(http.MethodGet, "/api/dashboard?"+query.Encode(), token, nil)
}

func (d *dashboardFixture) body(token string, query url.Values) map[string]any {
	d.e.T.Helper()
	resp := d.get(token, query)
	if resp.Status != http.StatusOK {
		d.e.T.Fatalf("dashboard %s: status %d, body %v", query.Encode(), resp.Status, resp.Body)
	}
	return resp.Body
}

// numbers returns the nine numbers for the filter.
func (d *dashboardFixture) numbers(token string, query url.Values) map[string]any {
	d.e.T.Helper()
	return cells(d.body(token, query)["numbers"])
}

func (d *dashboardFixture) number(token string, query url.Values, name string) any {
	d.e.T.Helper()
	return d.numbers(token, query)[name]
}

// cells turns the {applicable, value} objects into plain values, leaving the rest as is.
func cells(raw any) map[string]any {
	object, _ := raw.(map[string]any)
	out := make(map[string]any, len(object))
	for name, v := range object {
		cell, ok := v.(map[string]any)
		if _, isCell := cell["applicable"]; !ok || !isCell {
			continue
		}
		switch {
		case cell["applicable"] != true:
			if cell["value"] != nil {
				panic(fmt.Sprintf("%s: value without applying: %v", name, cell))
			}
			out[name] = notApplicable
		case cell["value"] == nil:
			out[name] = nil
		default:
			out[name] = int(cell["value"].(float64))
		}
	}
	return out
}

func wantNumbers(queued, inProgress, received, started, resolved, transferred, cancelled, wait, handling any) map[string]any {
	return map[string]any{
		"queued": queued, "inProgress": inProgress, "received": received, "started": started,
		"resolved": resolved, "transferred": transferred, "cancelled": cancelled,
		"averageWaitSeconds": wait, "averageHandlingSeconds": handling,
	}
}

func wantRow(inProgress, started, resolved, transferred, cancelled, handling any) map[string]any {
	return map[string]any{
		"inProgress": inProgress, "started": started, "resolved": resolved,
		"transferred": transferred, "cancelled": cancelled, "averageHandlingSeconds": handling,
	}
}

// rows returns the table of the dashboard by "person/sector", in the order of the response.
func (d *dashboardFixture) rows(token string, query url.Values) ([]string, map[string]map[string]any) {
	d.e.T.Helper()
	list, _ := d.body(token, query)["assignees"].([]any)
	order := make([]string, len(list))
	out := make(map[string]map[string]any, len(list))
	for i, raw := range list {
		row, _ := raw.(map[string]any)
		user, _ := row["user"].(map[string]any)
		sector, _ := row["sector"].(map[string]any)
		key := fmt.Sprintf("%v/%v", user["name"], sector["name"])
		order[i] = key
		out[key] = cells(row)
	}
	return order, out
}

func filtered(pairs ...any) url.Values {
	query := url.Values{"from": dashboardQuery["from"], "to": dashboardQuery["to"]}
	for i := 0; i < len(pairs); i += 2 {
		query.Set(pairs[i].(string), fmt.Sprint(pairs[i+1]))
	}
	return query
}

// filterScenario is one ticket of each kind in the day of the tests:
//
//	queuedA     fila, órgão A, recebido
//	progressA   Ana, órgão A, recebido, espera 60 s
//	startedB    Ana, órgão B, iniciado no sistema
//	phoneB      fila, órgão B, iniciado pelo celular
//	resolvedA   Ana, órgão A, módulo A, espera 120 s, atendimento 600 s
//	resolvedB   Bia, órgão B, módulos A e B, espera 180 s, atendimento 1200 s
//	moved       Ana, órgão A, módulo B, espera 240 s, atendimento 1800 s, para o RH
//	cancelledA  supervisor, órgão A, cancelado da fila
func filterScenario(t *testing.T) *dashboardFixture {
	t.Helper()
	d := newDashboard(t)
	d.timed(d.received(d.contab.ID, d.orgA).ID, -1, -1)
	d.timed(d.assigned(d.contab.ID, d.orgA, d.anaToken).ID, 60, -1)
	d.timed(d.started(d.contab.ID, d.orgB, d.anaToken).ID, 5, -1)
	d.timed(d.phoneTicket(d.contab.ID, d.orgB).ID, -1, -1)
	d.timed(d.resolved(d.orgA, d.anaToken, d.modA).ID, 120, 600)
	d.timed(d.resolved(d.orgB, d.biaToken, d.modA, d.modB).ID, 180, 1200)
	origin, destination := d.transferred(d.orgA, d.anaToken, d.modB)
	d.timed(origin.ID, 240, 1800)
	d.timed(destination.ID, -1, -1)
	queue := d.received(d.contab.ID, d.orgA)
	d.cancel(queue.ID, d.supToken)
	d.setTimes(queue.ID, ticketTimes{arrived: &dashboardNoon, closed: &dashboardNoon})
	return d
}

func TestDashboardAppliesEachFilterToTheNumbersItFits(t *testing.T) {
	t.Parallel()
	d := filterScenario(t)
	const na = notApplicable
	sector := d.contab.ID

	cases := []struct {
		name  string
		token string
		query url.Values
		want  map[string]any
	}{
		{"setor", d.adminToken, filtered("sectorId", sector), wantNumbers(2, 2, 6, 2, 2, 1, 1, 150, 1200)},
		{"outro setor", d.adminToken, filtered("sectorId", d.rh.ID), wantNumbers(1, 0, 1, 0, 0, 0, 0, nil, nil)},
		{"todos os setores", d.adminToken, filtered(), wantNumbers(3, 2, 7, 2, 2, 1, 1, 150, 1200)},
		{"atendente", d.adminToken, filtered("sectorId", sector, "assigneeId", d.ana.ID), wantNumbers(na, 2, na, 1, 1, 1, 0, na, 1200)},
		{"atendente que só cancelou", d.adminToken, filtered("sectorId", sector, "assigneeId", d.sup.ID), wantNumbers(na, 0, na, 0, 0, 0, 1, na, nil)},
		{"módulo A", d.adminToken, filtered("sectorId", sector, "moduleId", d.modA), wantNumbers(na, na, na, na, 2, 0, na, na, 900)},
		{"módulo B", d.adminToken, filtered("sectorId", sector, "moduleId", d.modB), wantNumbers(na, na, na, na, 1, 1, na, na, 1500)},
		{"órgão A", d.adminToken, filtered("sectorId", sector, "organizationId", d.orgA), wantNumbers(1, 1, 5, 0, 1, 1, 1, 140, 1200)},
		{"órgão B", d.adminToken, filtered("sectorId", sector, "organizationId", d.orgB), wantNumbers(1, 1, 1, 2, 1, 0, 0, 180, 1200)},
		{"órgão sem setor", d.adminToken, filtered("organizationId", d.orgA), wantNumbers(2, 1, 6, 0, 1, 1, 1, 140, 1200)},
		{"atendente e módulo", d.adminToken, filtered("sectorId", sector, "assigneeId", d.ana.ID, "moduleId", d.modB), wantNumbers(na, na, na, na, 0, 1, na, na, 1800)},
		{"atendente e órgão", d.adminToken, filtered("sectorId", sector, "assigneeId", d.ana.ID, "organizationId", d.orgB), wantNumbers(na, 1, na, 1, 0, 0, 0, na, nil)},
		{"supervisor sem pedir setor", d.supToken, filtered(), wantNumbers(2, 2, 6, 2, 2, 1, 1, 150, 1200)},
	}
	for _, c := range cases {
		if got := d.numbers(c.token, c.query); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s:\n got %v\nwant %v", c.name, got, c.want)
		}
	}
}

func TestDashboardTableFollowsTheSameRules(t *testing.T) {
	t.Parallel()
	d := filterScenario(t)
	const na = notApplicable
	ana, bia, sup := d.ana.Name+"/Contabilidade", d.bia.Name+"/Contabilidade", d.sup.Name+"/Contabilidade"
	sector := d.contab.ID

	cases := []struct {
		name  string
		query url.Values
		want  map[string]map[string]any
	}{
		{"setor", filtered("sectorId", sector), map[string]map[string]any{
			ana: wantRow(2, 1, 1, 1, 0, 1200), bia: wantRow(0, 0, 1, 0, 0, 1200), sup: wantRow(0, 0, 0, 0, 1, nil),
		}},
		{"atendente", filtered("sectorId", sector, "assigneeId", d.bia.ID), map[string]map[string]any{
			bia: wantRow(0, 0, 1, 0, 0, 1200),
		}},
		// Com módulo, quem só tem número que não se aplica sai da tabela.
		{"módulo", filtered("sectorId", sector, "moduleId", d.modB), map[string]map[string]any{
			ana: wantRow(na, na, 0, 1, na, 1800), bia: wantRow(na, na, 1, 0, na, 1200),
		}},
		{"órgão", filtered("sectorId", sector, "organizationId", d.orgB), map[string]map[string]any{
			ana: wantRow(1, 1, 0, 0, 0, nil), bia: wantRow(0, 0, 1, 0, 0, 1200),
		}},
		{"setor sem ninguém", filtered("sectorId", d.rh.ID), map[string]map[string]any{}},
	}
	for _, c := range cases {
		if _, got := d.rows(d.adminToken, c.query); !reflect.DeepEqual(got, c.want) {
			t.Errorf("%s:\n got %v\nwant %v", c.name, got, c.want)
		}
	}
}

func TestDashboardTableCreditsTheFinalAssignee(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	today := url.Values{}
	ana, bia := d.ana.Name+"/Contabilidade", d.bia.Name+"/Contabilidade"

	// Passou da Ana para a Bia: o encerramento é só da Bia.
	passed := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	if resp := d.e.transfer(passed.ID, d.bia.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	d.close(passed.ID, d.biaToken, d.form(d.orgA, d.modA))
	// A Ana iniciou e passou para a Bia: iniciado é de quem iniciou, em atendimento é do responsável.
	begun := d.started(d.contab.ID, d.orgA, d.anaToken)
	if resp := d.e.transfer(begun.ID, d.bia.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	// O supervisor cancelou um chamado da Bia: o cancelado é da Bia.
	d.cancel(d.assigned(d.contab.ID, d.orgA, d.biaToken).ID, d.supToken)

	order, rows := d.rows(d.supToken, today)
	if len(order) != 2 || order[0] != ana || order[1] != bia {
		t.Fatalf("order = %v", order)
	}
	if rows[ana]["started"] != 1 || rows[ana]["resolved"] != 0 || rows[ana]["inProgress"] != 0 {
		t.Fatalf("ana = %v", rows[ana])
	}
	if rows[bia]["started"] != 0 || rows[bia]["resolved"] != 1 || rows[bia]["inProgress"] != 1 || rows[bia]["cancelled"] != 1 {
		t.Fatalf("bia = %v", rows[bia])
	}
	if cancelled := d.number(d.supToken, url.Values{"assigneeId": {fmt.Sprint(d.sup.ID)}}, "cancelled"); cancelled != 0 {
		t.Fatalf("cancelled by the supervisor = %v", cancelled)
	}
}

func TestDashboardTableHasOneRowPerPersonAndSector(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	d.assigned(d.contab.ID, d.orgA, d.adminToken)
	d.assigned(d.rh.ID, d.orgA, d.adminToken)
	d.assigned(d.rh.ID, d.orgB, d.rhToken)

	order, rows := d.rows(d.adminToken, url.Values{})
	admin := d.admin.Name
	want := []string{admin + "/Contabilidade", admin + "/RH", d.rhUser.Name + "/RH"}
	if !reflect.DeepEqual(order, want) {
		t.Fatalf("order = %v, want %v", order, want)
	}
	for _, key := range want {
		if rows[key]["inProgress"] != 1 {
			t.Fatalf("%s = %v", key, rows[key])
		}
	}
	// O setor filtrado fica só com as linhas dele.
	if order, _ := d.rows(d.adminToken, url.Values{"sectorId": {fmt.Sprint(d.rh.ID)}}); !reflect.DeepEqual(order, want[1:]) {
		t.Fatalf("order in RH = %v", order)
	}
}

// Cada número entra no período pela sua data, com os dias no horário de
// Brasília: o último segundo de um dia ainda é o dia seguinte em UTC.
func TestDashboardPutsEachNumberInThePeriodByItsDate(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	other := dashboardDay.AddDate(0, -1, 0)

	receivedTicket := d.received(d.contab.ID, d.orgA)
	startedTicket := d.started(d.contab.ID, d.orgA, d.anaToken)
	waitTicket := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	resolvedTicket := d.resolved(d.orgB, d.anaToken, d.modA)
	movedTicket, destination := d.transferred(d.orgB, d.anaToken, d.modA)
	cancelledQueue := d.received(d.contab.ID, d.orgB)
	d.cancel(cancelledQueue.ID, d.supToken)

	// Tudo em outro mês, inclusive o destino da transferência.
	for _, id := range []int64{receivedTicket.ID, startedTicket.ID, waitTicket.ID, resolvedTicket.ID, movedTicket.ID, cancelledQueue.ID, destination.ID} {
		d.setTimes(id, ticketTimes{arrived: &other, assigned: &other})
	}
	for _, id := range []int64{resolvedTicket.ID, movedTicket.ID, cancelledQueue.ID} {
		d.setTimes(id, ticketTimes{ended: &other, closed: &other})
	}

	inside := []time.Time{dashboardDay, dashboardDay.AddDate(0, 0, 1).Add(-time.Second)}
	outside := []time.Time{dashboardDay.Add(-time.Second), dashboardDay.AddDate(0, 0, 1)}
	byDate := func(id int64, set func(at *time.Time) ticketTimes, restore ticketTimes, name string, inValue, outValue any) {
		t.Helper()
		query := filtered("sectorId", d.contab.ID)
		for _, at := range inside {
			d.setTimes(id, set(&at))
			if got := d.number(d.supToken, query, name); got != inValue {
				t.Errorf("%s with %v = %v, want %v", name, at, got, inValue)
			}
		}
		for _, at := range outside {
			d.setTimes(id, set(&at))
			if got := d.number(d.supToken, query, name); got != outValue {
				t.Errorf("%s with %v = %v, want %v", name, at, got, outValue)
			}
		}
		d.setTimes(id, restore)
	}
	arrive := func(at *time.Time) ticketTimes { return ticketTimes{arrived: at} }
	closes := func(at *time.Time) ticketTimes { return ticketTimes{closed: at} }

	byDate(receivedTicket.ID, arrive, ticketTimes{arrived: &other}, "received", 1, 0)
	byDate(startedTicket.ID, arrive, ticketTimes{arrived: &other}, "started", 1, 0)
	byDate(resolvedTicket.ID, closes, ticketTimes{closed: &other}, "resolved", 1, 0)
	byDate(movedTicket.ID, closes, ticketTimes{closed: &other}, "transferred", 1, 0)
	byDate(cancelledQueue.ID, closes, ticketTimes{closed: &other}, "cancelled", 1, 0)

	// The wait enters by the assignment, not by the arrival, a day before the period.
	dayBefore := dashboardDay.AddDate(0, 0, -1)
	d.setTimes(waitTicket.ID, ticketTimes{arrived: &dayBefore})
	wait := func(at time.Time) any { return int(at.Sub(dayBefore).Seconds()) }
	query := filtered("sectorId", d.contab.ID)
	for _, at := range inside {
		d.setTimes(waitTicket.ID, ticketTimes{assigned: &at})
		if got := d.number(d.supToken, query, "averageWaitSeconds"); got != wait(at) {
			t.Errorf("wait assigned at %v = %v, want %v", at, got, wait(at))
		}
	}
	for _, at := range outside {
		d.setTimes(waitTicket.ID, ticketTimes{assigned: &at})
		if got := d.number(d.supToken, query, "averageWaitSeconds"); got != nil {
			t.Errorf("wait assigned at %v = %v", at, got)
		}
	}
	d.setTimes(waitTicket.ID, ticketTimes{arrived: &other, assigned: &other})

	// The handling time enters by the real closing, not by the edited end.
	end := other.Add(time.Hour)
	d.setTimes(resolvedTicket.ID, ticketTimes{ended: &end})
	for _, at := range inside {
		d.setTimes(resolvedTicket.ID, ticketTimes{closed: &at})
		if got := d.number(d.supToken, query, "averageHandlingSeconds"); got != 3600 {
			t.Errorf("handling closed at %v = %v", at, got)
		}
	}
	for _, at := range outside {
		d.setTimes(resolvedTicket.ID, ticketTimes{closed: &at})
		if got := d.number(d.supToken, query, "averageHandlingSeconds"); got != nil {
			t.Errorf("handling closed at %v = %v", at, got)
		}
	}
	d.setTimes(resolvedTicket.ID, ticketTimes{closed: &other})

	// A fila e os em atendimento não mudam com o período.
	numbers := d.numbers(d.supToken, query)
	if numbers["queued"] != 1 || numbers["inProgress"] != 2 {
		t.Fatalf("current numbers = %v", numbers)
	}
}

func TestDashboardNamedPeriodsCountToday(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	now := time.Now().In(dashboardZone)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, dashboardZone)
	ticket := d.resolved(d.orgA, d.anaToken, d.modA)
	moved := func(at time.Time) { d.setTimes(ticket.ID, ticketTimes{closed: &at}) }

	cases := []struct {
		period string
		days   int
	}{{"today", 1}, {"7d", 7}, {"30d", 30}, {"", 1}}
	for _, c := range cases {
		query := url.Values{}
		if c.period != "" {
			query.Set("period", c.period)
		}
		first := today.AddDate(0, 0, 1-c.days)
		moved(first)
		if got := d.number(d.supToken, query, "resolved"); got != 1 {
			t.Errorf("%q: first day = %v", c.period, got)
		}
		moved(first.Add(-time.Second))
		if got := d.number(d.supToken, query, "resolved"); got != 0 {
			t.Errorf("%q: day before = %v", c.period, got)
		}
		period, _ := d.body(d.supToken, query)["period"].(map[string]any)
		if period["from"] != first.Format(time.DateOnly) || period["to"] != today.Format(time.DateOnly) {
			t.Errorf("%q: period = %v", c.period, period)
		}
	}
}

func TestDashboardCountsTransferInOriginAndDestination(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	origin, destination := d.transferred(d.orgA, d.anaToken, d.modA)

	numbers := func(sector *int64) map[string]any {
		t.Helper()
		query := url.Values{}
		if sector != nil {
			query.Set("sectorId", fmt.Sprint(*sector))
		}
		return d.numbers(d.adminToken, query)
	}
	check := func(got map[string]any, received, transferred, queued int) {
		t.Helper()
		if got["received"] != received || got["transferred"] != transferred || got["queued"] != queued {
			t.Fatalf("numbers = %v", got)
		}
	}
	check(numbers(&d.contab.ID), 1, 1, 0)
	check(numbers(&d.rh.ID), 1, 0, 1)
	check(numbers(nil), 2, 1, 1)
	if status := d.get(d.rhSupToken, url.Values{}).Status; status != http.StatusOK {
		t.Fatalf("supervisor at the destination: status %d", status)
	}
	check(d.numbers(d.rhSupToken, url.Values{}), 1, 0, 1)

	// A espera do destino começa na transferência, sem contar a da origem.
	arrived := dashboardNoon
	assigned := arrived.Add(90 * time.Second)
	if resp := d.e.assign(destination.ID, d.rhToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	originAssigned := arrived.Add(30 * time.Second)
	d.setTimes(origin.ID, ticketTimes{arrived: &arrived, assigned: &originAssigned, ended: &arrived, closed: &arrived})
	d.setTimes(destination.ID, ticketTimes{arrived: &arrived, assigned: &assigned})
	if got := d.number(d.adminToken, filtered("sectorId", d.rh.ID), "averageWaitSeconds"); got != 90 {
		t.Fatalf("wait at the destination = %v", got)
	}
	if got := d.number(d.adminToken, filtered("sectorId", d.contab.ID), "averageWaitSeconds"); got != 30 {
		t.Fatalf("wait at the origin = %v", got)
	}
	if got := d.number(d.adminToken, filtered(), "averageWaitSeconds"); got != 60 {
		t.Fatalf("wait in all sectors = %v", got)
	}
}

func TestDashboardTellsReceivedFromStarted(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	check := func(received, started int) {
		t.Helper()
		got := d.numbers(d.supToken, url.Values{})
		if got["received"] != received || got["started"] != started {
			t.Fatalf("numbers = %v, want received %d, started %d", got, received, started)
		}
	}

	// Iniciado no sistema: fica fora dos recebidos.
	d.started(d.contab.ID, d.orgA, d.anaToken)
	check(0, 1)

	// Aberto pelo celular: é iniciado, mesmo com a resposta do cliente em seguida,
	// e o relógio do celular adiantado não muda quem abriu.
	phone := d.phoneTicket(d.contab.ID, d.orgA)
	check(0, 2)
	var contactPhone string
	if err := d.e.Pool.QueryRow(t.Context(), "select phone from contacts where id = $1", phone.ContactID).Scan(&contactPhone); err != nil {
		t.Fatal(err)
	}
	reply := text("REPLY-1", contactPhone+"@s.whatsapp.net", contactPhone, "Bom dia")
	reply.SentAt = phone.ArrivedAt.Add(-time.Minute)
	d.e.receive(d.contab.ID, reply)
	check(0, 2)

	// Opened by the customer: received, even if the phone answers later.
	customer := d.received(d.contab.ID, d.orgA)
	check(1, 2)
	if err := d.e.Pool.QueryRow(t.Context(), "select phone from contacts where id = $1", customer.ContactID).Scan(&contactPhone); err != nil {
		t.Fatal(err)
	}
	d.e.sendOutside(d.contab.ID, text("OUT-AFTER", contactPhone+"@s.whatsapp.net", contactPhone, "Olá"))
	check(1, 2)

	// Iniciados pelo sistema e pelo celular ficam fora da espera, mesmo assumidos.
	if resp := d.e.assign(phone.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if got := d.number(d.supToken, url.Values{}, "averageWaitSeconds"); got != nil {
		t.Fatalf("wait = %v", got)
	}

	// Com filtro de atendente, iniciado pelo celular não é de ninguém.
	ana := url.Values{"assigneeId": {fmt.Sprint(d.ana.ID)}}
	if got := d.number(d.supToken, ana, "started"); got != 1 {
		t.Fatalf("started by Ana = %v", got)
	}

	// Chamado que veio de outro setor é recebido, mesmo que a primeira mensagem nele seja do celular.
	origin, destination := d.transferred(d.orgB, d.anaToken, d.modA)
	if err := d.e.Pool.QueryRow(t.Context(), "select phone from contacts where id = $1", origin.ContactID).Scan(&contactPhone); err != nil {
		t.Fatal(err)
	}
	d.e.sendOutside(d.rh.ID, text("OUT-RH", contactPhone+"@s.whatsapp.net", contactPhone, "Aqui é do RH"))
	if got := d.e.messages(destination.ID); len(got) != 1 {
		t.Fatalf("messages at the destination = %v", got)
	}
	rh := d.numbers(d.rhSupToken, url.Values{})
	if rh["received"] != 1 || rh["started"] != 0 {
		t.Fatalf("destination = %v", rh)
	}
	if resp := d.e.assign(destination.ID, d.rhToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if got := d.number(d.rhSupToken, url.Values{}, "averageWaitSeconds"); got == nil {
		t.Fatal("the destination has no wait")
	}
}

func TestDashboardWaitCountsOnlyTheFirstTimeInTheQueue(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	query := filtered("sectorId", d.contab.ID)
	wait := func() any {
		t.Helper()
		return d.number(d.supToken, query, "averageWaitSeconds")
	}

	ticket := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.timed(ticket.ID, 300, -1)
	if got := wait(); got != 300 {
		t.Fatalf("wait = %v", got)
	}

	// Devolvido à fila e assumido por outra pessoa: a espera continua a da primeira vez.
	if resp := d.e.returnToQueue(ticket.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("return: status %d", resp.Status)
	}
	if got := wait(); got != 300 {
		t.Fatalf("wait after returning = %v", got)
	}
	if resp := d.e.assign(ticket.ID, d.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if got := wait(); got != 300 {
		t.Fatalf("wait after assuming again = %v", got)
	}

	// Cancelado da fila: nunca foi assumido, então fica fora.
	queue := d.received(d.contab.ID, d.orgA)
	d.cancel(queue.ID, d.supToken)
	d.setTimes(queue.ID, ticketTimes{arrived: &dashboardNoon, closed: &dashboardNoon})
	if got := wait(); got != 300 {
		t.Fatalf("wait with a ticket cancelled from the queue = %v", got)
	}

	// Chegada depois de assumir (relógio de quem enviou adiantado) conta como espera zero.
	ahead := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	later := dashboardNoon.Add(time.Hour)
	d.setTimes(ahead.ID, ticketTimes{arrived: &later, assigned: &dashboardNoon})
	if got := wait(); got != 150 {
		t.Fatalf("wait with the clock ahead = %v", got)
	}

	// Média arredondada ao segundo.
	third := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.timed(third.ID, 1, -1)
	if got := wait(); got != 100 {
		t.Fatalf("rounded wait = %v", got)
	}
}

func TestDashboardHandlingTimeUsesTheAssignmentAndTheEnd(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	query := filtered("sectorId", d.contab.ID)
	handling := func() any {
		t.Helper()
		return d.number(d.supToken, query, "averageHandlingSeconds")
	}
	assignedAt := time.Now().Add(-5 * time.Hour).Truncate(time.Minute)
	closedInDay := func(ticketID int64) {
		t.Helper()
		d.setTimes(ticketID, ticketTimes{assigned: &assignedAt, closed: &dashboardNoon})
	}

	// O "Início" editado é ignorado e o "Fim" editado é respeitado.
	edited := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.setTimes(edited.ID, ticketTimes{assigned: &assignedAt})
	form := with(with(d.form(d.orgA, d.modA), "startedAt", assignedAt.Add(-3*time.Hour)), "endedAt", assignedAt.Add(time.Hour))
	d.close(edited.ID, d.anaToken, form)
	closedInDay(edited.ID)
	if got := handling(); got != 3600 {
		t.Fatalf("handling = %v", got)
	}

	// "Fim" anterior a ter sido assumido: fica fora da média, mas é um encerrado.
	early := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.setTimes(early.ID, ticketTimes{assigned: &assignedAt})
	form = with(with(d.form(d.orgA, d.modA), "startedAt", assignedAt.Add(-3*time.Hour)), "endedAt", assignedAt.Add(-time.Minute))
	d.close(early.ID, d.anaToken, form)
	closedInDay(early.ID)
	numbers := d.numbers(d.supToken, query)
	if numbers["averageHandlingSeconds"] != 3600 || numbers["resolved"] != 2 {
		t.Fatalf("numbers = %v", numbers)
	}
	_, rows := d.rows(d.supToken, query)
	if row := rows[d.ana.Name+"/Contabilidade"]; row["averageHandlingSeconds"] != 3600 || row["resolved"] != 2 {
		t.Fatalf("row = %v", row)
	}

	// An end equal to the assignment counts, with zero.
	same := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.setTimes(same.ID, ticketTimes{assigned: &assignedAt})
	form = with(with(d.form(d.orgA, d.modA), "startedAt", assignedAt.Add(-time.Hour)), "endedAt", assignedAt)
	d.close(same.ID, d.anaToken, form)
	closedInDay(same.ID)
	if got := handling(); got != 1800 {
		t.Fatalf("handling with a zero = %v", got)
	}

	// Cancelados ficam fora, inclusive os já assumidos.
	cancelled := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.cancel(cancelled.ID, d.anaToken)
	closedInDay(cancelled.ID)
	numbers = d.numbers(d.supToken, query)
	if numbers["averageHandlingSeconds"] != 1800 || numbers["cancelled"] != 1 {
		t.Fatalf("numbers with a cancelled ticket = %v", numbers)
	}

	// Transferidos entram na média.
	origin, _ := d.transferred(d.orgA, d.anaToken, d.modA)
	moved := assignedAt.Add(3 * time.Hour)
	d.setTimes(origin.ID, ticketTimes{arrived: &assignedAt, assigned: &assignedAt, ended: &moved, closed: &dashboardNoon})
	if got := handling(); got != 4800 {
		t.Fatalf("handling with a transfer = %v", got)
	}
}

func TestDashboardReflectsCorrections(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	ticket := d.resolved(d.orgA, d.anaToken, d.modA)
	d.timed(ticket.ID, 60, 600)
	base := filtered("sectorId", d.contab.ID)
	resolved := func(key string, value int64) any {
		t.Helper()
		query := filtered("sectorId", d.contab.ID, key, value)
		return d.number(d.supToken, query, "resolved")
	}
	if resolved("organizationId", d.orgA) != 1 || resolved("organizationId", d.orgB) != 0 ||
		resolved("moduleId", d.modA) != 1 || resolved("moduleId", d.modB) != 0 {
		t.Fatal("before the correction")
	}

	started := dashboardNoon.Add(time.Minute)
	ended := started.Add(20 * time.Minute)
	resp := d.e.correct(ticket.ID, d.supToken, map[string]any{
		"subject": "Dúvida", "resolution": "Resolvida.", "moduleIds": []int64{d.modB}, "organizationId": d.orgB,
		"startedAt": started, "endedAt": ended, "spokeWith": "", "reason": "Órgão errado",
	})
	if resp.Status != http.StatusOK {
		t.Fatalf("correct: status %d, body %v", resp.Status, resp.Body)
	}
	if resolved("organizationId", d.orgA) != 0 || resolved("organizationId", d.orgB) != 1 ||
		resolved("moduleId", d.modA) != 0 || resolved("moduleId", d.modB) != 1 {
		t.Fatal("after the correction")
	}
	// O novo "Fim" vale para a média, a partir de quando foi assumido.
	if got := d.number(d.supToken, base, "averageHandlingSeconds"); got != 1200 {
		t.Fatalf("handling after the correction = %v", got)
	}
}

func TestDashboardPermissions(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	d.received(d.contab.ID, d.orgA)
	d.received(d.rh.ID, d.orgA)
	d.received(d.rh.ID, d.orgB)
	sector := func(id int64) url.Values { return url.Values{"sectorId": {fmt.Sprint(id)}} }

	// Atendente não vê, nem o próprio setor.
	for _, query := range []url.Values{{}, sector(d.contab.ID)} {
		if status := d.get(d.anaToken, query).Status; status != http.StatusForbidden {
			t.Fatalf("agent %v: status %d", query, status)
		}
	}
	if resp := d.e.Do(http.MethodGet, "/api/dashboard", "", nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("anonymous: status %d", resp.Status)
	}

	// Supervisor fica no próprio setor; pedir outro dá 403.
	body := d.body(d.supToken, url.Values{})
	if body["sectorId"] != float64(d.contab.ID) || cells(body["numbers"])["queued"] != 1 {
		t.Fatalf("supervisor = %v", body)
	}
	if got := d.number(d.supToken, sector(d.contab.ID), "queued"); got != 1 {
		t.Fatalf("supervisor in the own sector = %v", got)
	}
	if status := d.get(d.supToken, sector(d.rh.ID)).Status; status != http.StatusForbidden {
		t.Fatalf("supervisor in another sector: status %d", status)
	}
	if status := d.get(d.supToken, sector(999999)).Status; status != http.StatusForbidden {
		t.Fatalf("supervisor in an unknown sector: status %d", status)
	}

	// Administrador vê um setor ou todos.
	body = d.body(d.adminToken, url.Values{})
	if body["sectorId"] != nil || cells(body["numbers"])["queued"] != 3 {
		t.Fatalf("admin in all sectors = %v", body)
	}
	if got := d.number(d.adminToken, sector(d.rh.ID), "queued"); got != 2 {
		t.Fatalf("admin in a sector = %v", got)
	}
}

func TestDashboardRefusesInvalidFilters(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	cases := []struct {
		name  string
		token string
		query string
	}{
		{"atendente sem setor", d.adminToken, fmt.Sprintf("assigneeId=%d", d.ana.ID)},
		{"módulo sem setor", d.adminToken, fmt.Sprintf("moduleId=%d", d.modA)},
		{"atendente de outro setor", d.adminToken, fmt.Sprintf("sectorId=%d&assigneeId=%d", d.contab.ID, d.rhUser.ID)},
		{"módulo de outro setor", d.adminToken, fmt.Sprintf("sectorId=%d&moduleId=%d", d.contab.ID, d.rhMod)},
		{"supervisor com atendente de outro setor", d.supToken, fmt.Sprintf("assigneeId=%d", d.rhUser.ID)},
		{"supervisor com módulo de outro setor", d.supToken, fmt.Sprintf("moduleId=%d", d.rhMod)},
		{"setor que não existe", d.adminToken, "sectorId=999999"},
		{"órgão que não existe", d.adminToken, "organizationId=999999"},
		{"setor inválido", d.adminToken, "sectorId=abc"},
		{"setor zero", d.adminToken, "sectorId=0"},
		{"atendente inválido", d.supToken, "assigneeId=abc"},
		{"módulo inválido", d.supToken, "moduleId=-1"},
		{"órgão inválido", d.supToken, "organizationId=1.5"},
		{"período desconhecido", d.supToken, "period=ontem"},
		{"data inválida", d.supToken, "from=10/03/2026&to=2026-03-10"},
		{"dia que não existe", d.supToken, "from=2026-02-30&to=2026-03-01"},
		{"início depois do fim", d.supToken, "from=2026-03-11&to=2026-03-10"},
		{"só o início", d.supToken, "from=2026-03-10"},
		{"só o fim", d.supToken, "to=2026-03-10"},
		{"nome e datas", d.supToken, "period=today&from=2026-03-10&to=2026-03-10"},
	}
	for _, c := range cases {
		if resp := d.e.Do(http.MethodGet, "/api/dashboard?"+c.query, c.token, nil); resp.Status != http.StatusBadRequest {
			t.Errorf("%s: status %d, body %v", c.name, resp.Status, resp.Body)
		}
	}
	// Datas extremas, mas válidas, não viram erro interno.
	if numbers := d.numbers(d.supToken, url.Values{"from": {"0001-01-01"}, "to": {"9999-12-31"}}); numbers["received"] != 0 {
		t.Fatalf("widest period = %v", numbers)
	}
	// Um dia só e datas no futuro são válidos, sem dados.
	numbers := d.numbers(d.supToken, url.Values{"from": {"2099-01-01"}, "to": {"2099-01-01"}})
	if numbers["received"] != 0 || numbers["averageWaitSeconds"] != nil {
		t.Fatalf("future = %v", numbers)
	}
}

func TestDashboardAssigneeOptions(t *testing.T) {
	t.Parallel()
	d := newDashboard(t)
	path := func(sectorID int64) string { return fmt.Sprintf("/api/sectors/%d/dashboard/assignees", sectorID) }

	// Desativada continua na lista, para achar o histórico dela.
	if _, err := d.e.Pool.Exec(t.Context(), "update users set active = false where id = $1", d.bia.ID); err != nil {
		t.Fatal(err)
	}
	// O administrador assumiu um chamado e o passou adiante: já foi responsável, mesmo sem ficar com nenhum.
	passed := d.assigned(d.contab.ID, d.orgA, d.adminToken)
	if resp := d.e.transfer(passed.ID, d.ana.ID, d.adminToken); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}
	// Quem era do setor e foi para outro continua na lista, pelo chamado que ficou com ele.
	moved := d.e.User("mudou@exemplo.com", db.UserRoleAgent, &d.contab.ID)
	token := d.e.Login("mudou@exemplo.com", testPassword)
	d.resolved(d.orgA, token, d.modA)
	if _, err := d.e.Pool.Exec(t.Context(), "update users set sector_id = $2 where id = $1", moved.ID, d.rh.ID); err != nil {
		t.Fatal(err)
	}

	list := d.e.DoList(http.MethodGet, path(d.contab.ID), d.supToken)
	got := map[string]bool{}
	for _, option := range list {
		got[option["name"].(string)], _ = option["active"].(bool)
	}
	want := map[string]bool{d.ana.Name: true, d.bia.Name: false, d.sup.Name: true, d.admin.Name: true, moved.Name: true}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("options = %v, want %v", got, want)
	}

	// Todas as opções valem como filtro.
	for _, id := range []int64{d.ana.ID, d.bia.ID, d.sup.ID, d.admin.ID, moved.ID} {
		query := url.Values{"sectorId": {fmt.Sprint(d.contab.ID)}, "assigneeId": {fmt.Sprint(id)}}
		if status := d.get(d.adminToken, query).Status; status != http.StatusOK {
			t.Errorf("assignee %d: status %d", id, status)
		}
	}
	// Quem nunca passou pelo setor, não.
	query := url.Values{"sectorId": {fmt.Sprint(d.contab.ID)}, "assigneeId": {fmt.Sprint(d.rhUser.ID)}}
	if status := d.get(d.adminToken, query).Status; status != http.StatusBadRequest {
		t.Errorf("assignee of another sector: status %d", status)
	}

	// Permissões da rota.
	if status := d.e.Do(http.MethodGet, path(d.contab.ID), d.anaToken, nil).Status; status != http.StatusForbidden {
		t.Fatalf("agent: status %d", status)
	}
	if status := d.e.Do(http.MethodGet, path(d.rh.ID), d.supToken, nil).Status; status != http.StatusForbidden {
		t.Fatalf("supervisor of another sector: status %d", status)
	}
	if status := d.e.Do(http.MethodGet, path(d.rh.ID), d.adminToken, nil).Status; status != http.StatusOK {
		t.Fatalf("admin: status %d", status)
	}
	if status := d.e.Do(http.MethodGet, path(999999), d.adminToken, nil).Status; status != http.StatusNotFound {
		t.Fatalf("unknown sector: status %d", status)
	}
}
