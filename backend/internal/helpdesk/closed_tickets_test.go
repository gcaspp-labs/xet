package helpdesk_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"slices"
	"testing"
	"time"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
)

// setClosedAt moves the real closing moment of a ticket, which the API never
// changes, to test the limits of the day.
func (e *testEnv) setClosedAt(ticketID int64, at time.Time) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(), "update tickets set closed_at = $2 where id = $1", ticketID, at); err != nil {
		e.T.Fatal(err)
	}
}

// brasilia is the office clock the periods of the history follow.
func brasilia(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		t.Fatal(err)
	}
	return loc
}

func dayStart(t *testing.T, offset int) time.Time {
	t.Helper()
	now := time.Now().In(brasilia(t))
	return time.Date(now.Year(), now.Month(), now.Day()+offset, 0, 0, 0, 0, brasilia(t))
}

// closedTicket is a ticket the history tests insert already closed.
type closedTicket struct {
	protocol, closureType string
	sector, contact       int64
	organization          *int64
	assignee              int64
	previous              *int64
	subject               string
	modules               []int64
	closedAt              time.Time
}

// insertClosed inserts a closed ticket that arrived three days before it was
// closed, so that the day of arrival never matches the day of closing.
func (e *testEnv) insertClosed(f closedTicket) int64 {
	e.T.Helper()
	arrived := f.closedAt.Add(-72 * time.Hour)
	var subject *string
	if f.subject != "" {
		subject = &f.subject
	}
	var id int64
	err := e.Pool.QueryRow(e.T.Context(), `
		insert into tickets (protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id,
		    arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution)
		values ($1, $2, $3, $4, $5, 'closed', $6, $7, $7, $7, $8, $9, $5, $10::closure_type, $11, 'Resolvido')
		returning id`,
		f.protocol, f.sector, f.contact, f.organization, f.assignee, f.previous,
		arrived, f.closedAt.Add(-time.Minute), f.closedAt, f.closureType, subject).Scan(&id)
	if err != nil {
		e.T.Fatal(err)
	}
	for _, module := range f.modules {
		if _, err := e.Pool.Exec(e.T.Context(), "insert into ticket_modules (ticket_id, module_id) values ($1, $2)", id, module); err != nil {
			e.T.Fatal(err)
		}
	}
	return id
}

// DoStrings performs a GET whose response is a JSON array of texts.
func (e *testEnv) DoStrings(path, token string) []string {
	e.T.Helper()
	req, err := http.NewRequestWithContext(e.T.Context(), http.MethodGet, e.URL+path, nil)
	if err != nil {
		e.T.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.T.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		e.T.Fatalf("GET %s: status %d", path, resp.StatusCode)
	}
	var out []string
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		e.T.Fatal(err)
	}
	return out
}

// closedList is a sector of Contabilidade and one of RH with closed tickets of
// every kind, and open ones that must never show.
type closedList struct {
	sectorTransfer
	bia, sup, rhUser int64
	// Contabilidade, by when each one closed.
	closedToday, closedYesterday, closedTenDaysAgo int64
	transferredFortyDaysAgo                        int64
	rhDone                                         int64 // RH, closed today
	rhNext                                         int64 // RH, queued, born from transferredFortyDaysAgo
	maria, joao, rui                               int64
}

func newClosedList(t *testing.T) closedList {
	t.Helper()
	c := closedList{sectorTransfer: newSectorTransfer(t)}
	e := c.e
	c.bia, c.sup, c.rhUser = e.userID("bia@exemplo.com"), e.userID("sup@exemplo.com"), e.userID("rh@exemplo.com")
	camara := e.Organization(c.supToken, "Câmara de Itu", "")
	c.maria = c.ticket.ContactID
	c.joao = e.Contact(c.supToken, "João da Silva", "5511966665555", camara, c.sector.ID)
	c.rui = e.Contact(c.rhToken, "Rui", "5511977776666", c.org, c.rh)

	today, yesterday := dayStart(t, 0), dayStart(t, -1)
	c.closedToday = e.insertClosed(closedTicket{
		protocol: "9001-000001", closureType: "resolved", sector: c.sector.ID, contact: c.maria, organization: &c.org,
		assignee: c.ana.ID, subject: "Contracheque atrasado", modules: c.modules[:1], closedAt: today.Add(time.Hour),
	})
	c.closedYesterday = e.insertClosed(closedTicket{
		protocol: "9001-000002", closureType: "resolved", sector: c.sector.ID, contact: c.joao, organization: &camara,
		assignee: c.bia, subject: "Férias", modules: c.modules, closedAt: yesterday.Add(time.Hour),
	})
	c.closedTenDaysAgo = e.insertClosed(closedTicket{
		protocol: "9001-000003", closureType: "cancelled", sector: c.sector.ID, contact: c.maria,
		assignee: c.sup, closedAt: today.AddDate(0, 0, -10).Add(time.Hour),
	})
	c.transferredFortyDaysAgo = e.insertClosed(closedTicket{
		protocol: "9001-000004", closureType: "transferred", sector: c.sector.ID, contact: c.rui, organization: &c.org,
		assignee: c.ana.ID, subject: "Imposto de renda", modules: c.modules[1:], closedAt: today.AddDate(0, 0, -40).Add(time.Hour),
	})
	c.rhDone = e.insertClosed(closedTicket{
		protocol: "9001-000005", closureType: "resolved", sector: c.rh, contact: c.rui, organization: &c.org,
		assignee: c.rhUser, subject: "Admissão", modules: []int64{c.rhModule}, closedAt: today.Add(2 * time.Hour),
	})
	// The transfer leaves a new ticket in the destination, still queued.
	if err := e.Pool.QueryRow(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, previous_ticket_id, arrived_at, started_at)
		values ('9001-000006', $1, $2, $3, 'queued', $4, now(), now()) returning id`, c.rh, c.rui, c.org, c.transferredFortyDaysAgo).Scan(&c.rhNext); err != nil {
		t.Fatal(err)
	}
	return c
}

func (c closedList) protocols(token, query string) []string {
	c.e.T.Helper()
	items := c.e.DoPageItems("/api/closed-tickets"+query, token)
	out := make([]string, len(items))
	for i, item := range items {
		out[i], _ = item["protocol"].(string)
	}
	return out
}

func (c closedList) expect(token, query string, want ...string) {
	c.e.T.Helper()
	if got := c.protocols(token, query); !slices.Equal(got, want) {
		c.e.T.Errorf("%s: protocols %v, want %v", query, got, want)
	}
}

func (c closedList) refuse(token, query string, status int) {
	c.e.T.Helper()
	if resp := c.e.Do(http.MethodGet, "/api/closed-tickets"+query, token, nil); resp.Status != status {
		c.e.T.Errorf("%s: status %d, want %d, body %v", query, resp.Status, status, resp.Body)
	}
}

func qs(pairs ...string) string {
	values := url.Values{}
	for i := 0; i < len(pairs); i += 2 {
		values.Set(pairs[i], pairs[i+1])
	}
	return "?" + values.Encode()
}

func TestClosedTicketsScopeBySector(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	e := c.e

	// Agent and supervisor see only their sector, latest closing first; the admin sees every sector.
	for _, token := range []string{c.anaToken, c.biaToken, c.supToken} {
		c.expect(token, "", "9001-000001", "9001-000002", "9001-000003", "9001-000004")
	}
	c.expect(c.rhToken, "", "9001-000005")
	c.expect(c.adminToken, "", "9001-000005", "9001-000001", "9001-000002", "9001-000003", "9001-000004")

	// The ticket that is open never shows, in any sector, and the total counts only the closed ones.
	_, resp := e.DoPage("/api/closed-tickets", c.adminToken)
	if resp.Body["total"] != float64(5) || resp.Body["page"] != float64(1) || resp.Body["pageSize"] != float64(20) {
		t.Fatalf("page = %v", resp.Body)
	}

	// The backend refuses another sector, whatever the screen asks.
	c.refuse(c.anaToken, qs("sectorId", fmt.Sprint(c.rh)), http.StatusForbidden)
	c.refuse(c.supToken, qs("sectorId", fmt.Sprint(c.rh)), http.StatusForbidden)
	c.refuse(c.rhToken, qs("sectorId", fmt.Sprint(c.sector.ID)), http.StatusForbidden)
	c.refuse("", "", http.StatusUnauthorized)
	for _, token := range []string{c.anaToken, c.supToken} {
		c.expect(token, qs("sectorId", fmt.Sprint(c.sector.ID)), "9001-000001", "9001-000002", "9001-000003", "9001-000004")
	}
	c.expect(c.adminToken, qs("sectorId", fmt.Sprint(c.rh)), "9001-000005")

	// Assignee and module belong to a sector: the admin needs one, and the assignee must be of it.
	c.refuse(c.adminToken, qs("assigneeId", fmt.Sprint(c.ana.ID)), http.StatusBadRequest)
	c.refuse(c.adminToken, qs("module", "folha"), http.StatusBadRequest)
	c.refuse(c.adminToken, qs("sectorId", fmt.Sprint(c.rh), "assigneeId", fmt.Sprint(c.ana.ID)), http.StatusBadRequest)
	c.refuse(c.supToken, qs("assigneeId", fmt.Sprint(c.rhUser)), http.StatusBadRequest)
	c.refuse(c.adminToken, qs("sectorId", "9999"), http.StatusBadRequest)
	c.refuse(c.adminToken, qs("sectorId", "x"), http.StatusBadRequest)
}

func TestClosedTicketsRefuseTheSituationFilter(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	for _, query := range []string{
		qs("status", "queued"), qs("status", "closed"), qs("situation", "cancelled"), qs("closureType", "resolved"),
	} {
		c.refuse(c.adminToken, query, http.StatusBadRequest)
		c.refuse(c.supToken, query, http.StatusBadRequest)
	}
}

func TestClosedTicketsPeriodsFollowTheRealClosing(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	day := func(offset int) string { return dayStart(t, offset).Format(time.DateOnly) }

	// All of them arrived three days before closing: "today" is the day of closing, not of arrival.
	c.expect(c.supToken, qs("period", "today"), "9001-000001")
	c.expect(c.supToken, qs("period", "7d"), "9001-000001", "9001-000002")
	c.expect(c.supToken, qs("period", "30d"), "9001-000001", "9001-000002", "9001-000003")
	c.expect(c.supToken, "", "9001-000001", "9001-000002", "9001-000003", "9001-000004")
	// The cancelled and the transferred tickets use their closing too.
	c.expect(c.supToken, qs("from", day(-10), "to", day(-10)), "9001-000003")
	c.expect(c.supToken, qs("from", day(-41), "to", day(-39)), "9001-000004")
	c.expect(c.supToken, qs("from", day(-1), "to", day(-1)), "9001-000002")
	c.expect(c.supToken, qs("from", day(0)), "9001-000001")
	c.expect(c.supToken, qs("to", day(-10)), "9001-000003", "9001-000004")
	c.expect(c.adminToken, qs("period", "today"), "9001-000005", "9001-000001")

	c.refuse(c.supToken, qs("period", "year"), http.StatusBadRequest)
	c.refuse(c.supToken, qs("period", "today", "from", day(0)), http.StatusBadRequest)
	c.refuse(c.supToken, qs("from", "ontem"), http.StatusBadRequest)
	c.refuse(c.supToken, qs("from", day(0), "to", day(-1)), http.StatusBadRequest)

	// The limits of the day in Brasília: the last second of yesterday is already today in UTC.
	e := c.e
	start := dayStart(t, 0)
	e.setClosedAt(c.closedToday, start.Add(-time.Second))
	c.expect(c.supToken, qs("period", "today"))
	e.setClosedAt(c.closedToday, start)
	c.expect(c.supToken, qs("period", "today"), "9001-000001")
	e.setClosedAt(c.closedToday, start.AddDate(0, 0, 1))
	c.expect(c.supToken, qs("period", "today"))
	c.expect(c.supToken, qs("from", day(1), "to", day(1)), "9001-000001")
}

func TestClosedTicketsSearchAndFilters(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	id := func(v int64) string { return fmt.Sprint(v) }

	// Search: protocol, contact, phone or organization, ignoring accents and case.
	c.expect(c.supToken, qs("q", "9001-000003"), "9001-000003")
	c.expect(c.supToken, qs("q", "JOAO"), "9001-000002")
	c.expect(c.supToken, qs("q", "joão da"), "9001-000002")
	c.expect(c.supToken, qs("q", "camara"), "9001-000002")
	c.expect(c.supToken, qs("q", "CAMPINAS"), "9001-000001", "9001-000004")
	c.expect(c.supToken, qs("q", "(11) 96666-5555"), "9001-000002")
	c.expect(c.supToken, qs("q", "66665555"), "9001-000002")
	c.expect(c.supToken, qs("q", "5511988887777"), "9001-000001", "9001-000003")
	c.expect(c.supToken, qs("q", "  maria  "), "9001-000001", "9001-000003")
	c.expect(c.supToken, qs("q", "nada disso"))
	c.expect(c.supToken, qs("q", "%"))
	// Text with a digit does not turn into a phone search.
	c.expect(c.supToken, qs("q", "maria 1"))
	// The search stays inside the sector of the user.
	c.expect(c.supToken, qs("q", "rui"), "9001-000004")
	c.expect(c.adminToken, qs("q", "rui"), "9001-000005", "9001-000004")
	c.expect(c.adminToken, qs("q", "campinas"), "9001-000005", "9001-000001", "9001-000004")

	// Assignee: who handled the ticket.
	c.expect(c.supToken, qs("assigneeId", id(c.ana.ID)), "9001-000001", "9001-000004")
	c.expect(c.supToken, qs("assigneeId", id(c.bia)), "9001-000002")
	c.expect(c.adminToken, qs("sectorId", id(c.sector.ID), "assigneeId", id(c.sup)), "9001-000003")

	// Module: any module of the ticket matches.
	c.expect(c.supToken, qs("module", "fol"), "9001-000001", "9001-000002")
	c.expect(c.supToken, qs("module", "PATRIMONIO"), "9001-000002", "9001-000004")
	c.expect(c.supToken, qs("module", "zzz"))
	// A text in the name of more than one module: every ticket with any of them, once.
	c.expect(c.supToken, qs("module", "o"), "9001-000001", "9001-000002", "9001-000004")
	c.expect(c.adminToken, qs("sectorId", id(c.rh), "module", "folha"), "9001-000005")

	// Subject: contains, ignoring accents and case.
	c.expect(c.supToken, qs("subject", "contra"), "9001-000001")
	c.expect(c.supToken, qs("subject", "FERIAS"), "9001-000002")
	c.expect(c.supToken, qs("subject", "renda"), "9001-000004")
	c.expect(c.supToken, qs("subject", "zzz"))
	c.expect(c.adminToken, qs("subject", "admiss"), "9001-000005")

	// The filters combine.
	c.expect(c.supToken, qs("q", "campinas", "assigneeId", id(c.ana.ID), "period", "7d"), "9001-000001")
	c.expect(c.supToken, qs("module", "folha", "subject", "ferias", "assigneeId", id(c.bia)), "9001-000002")
}

func TestClosedTicketsSortAndPage(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)

	for _, tc := range []struct {
		query string
		want  []string
	}{
		{qs("sort", "date", "direction", "asc"), []string{"9001-000004", "9001-000003", "9001-000002", "9001-000001"}},
		{qs("sort", "date", "direction", "desc"), []string{"9001-000001", "9001-000002", "9001-000003", "9001-000004"}},
		{qs("direction", "asc"), []string{"9001-000004", "9001-000003", "9001-000002", "9001-000001"}},
		{qs("sort", "protocol", "direction", "desc"), []string{"9001-000004", "9001-000003", "9001-000002", "9001-000001"}},
		{qs("sort", "contact", "direction", "asc"), []string{"9001-000002", "9001-000001", "9001-000003", "9001-000004"}}, // João, Maria, Maria, Rui
		{qs("sort", "contact", "direction", "desc"), []string{"9001-000004", "9001-000003", "9001-000001", "9001-000002"}},
		{qs("sort", "organization", "direction", "asc"), []string{"9001-000002", "9001-000001", "9001-000004", "9001-000003"}}, // Câmara, Campinas ×2 (by id), none
		{qs("sort", "assignee", "direction", "asc"), []string{"9001-000001", "9001-000004", "9001-000002", "9001-000003"}},     // Ana, Ana, Bia, Sup
		{qs("sort", "subject", "direction", "asc"), []string{"9001-000001", "9001-000002", "9001-000004", "9001-000003"}},      // Contracheque, Férias, Imposto, none
		{qs("sort", "subject", "direction", "desc"), []string{"9001-000004", "9001-000002", "9001-000001", "9001-000003"}},
		// Cancelado, Encerrado, Encerrado, Transferido.
		{qs("sort", "situation", "direction", "asc"), []string{"9001-000003", "9001-000001", "9001-000002", "9001-000004"}},
		{qs("sort", "situation", "direction", "desc"), []string{"9001-000004", "9001-000002", "9001-000001", "9001-000003"}},
		// Modules do not sort, and an unknown column goes back to the default order.
		{qs("sort", "modules", "direction", "asc"), []string{"9001-000001", "9001-000002", "9001-000003", "9001-000004"}},
		{qs("sort", "status"), []string{"9001-000001", "9001-000002", "9001-000003", "9001-000004"}},
	} {
		c.expect(c.supToken, tc.query, tc.want...)
	}
	c.expect(c.adminToken, qs("sort", "sector", "direction", "asc"), "9001-000001", "9001-000002", "9001-000003", "9001-000004", "9001-000005")
	c.expect(c.adminToken, qs("sort", "sector", "direction", "desc"), "9001-000005", "9001-000004", "9001-000003", "9001-000002", "9001-000001")
}

func TestClosedTicketsPaginate(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	e := c.e
	_, err := e.Pool.Exec(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id,
		    arrived_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution)
		select '9900-' || lpad(n::text, 6, '0'), $1::bigint, $2, $3, 'closed', $4,
		    now() - interval '10 days', now() - interval '10 days', now() - interval '1 hour',
		    now() - (100 - n) * interval '1 minute', $4, 'resolved', 'Assunto', 'Resolvido'
		from generate_series(1, 45) n`, c.sector.ID, c.maria, c.org, c.ana.ID)
	if err != nil {
		t.Fatal(err)
	}
	// 45 new ones, plus the 4 of the sector: 49 in all.
	for _, tc := range []struct {
		query string
		page  float64
		count int
	}{
		{"", 1, 20}, {qs("page", "2"), 2, 20}, {qs("page", "3"), 3, 9}, {qs("page", "999"), 3, 9}, {qs("page", "0"), 1, 20}, {qs("page", "x"), 1, 20},
	} {
		items, resp := e.DoPage("/api/closed-tickets"+tc.query, c.supToken)
		if resp.Body["total"] != float64(49) || resp.Body["page"] != tc.page || resp.Body["pageSize"] != float64(20) || len(items) != tc.count {
			t.Errorf("%q: page %v of %v, %d items, total %v", tc.query, resp.Body["page"], tc.page, len(items), resp.Body["total"])
		}
	}
	// The order is stable across pages: no ticket repeats or is lost.
	for _, column := range []string{"contact", "assignee", "situation", "subject", "organization", "sector", "date"} {
		for _, direction := range []string{"asc", "desc"} {
			seen := map[int64]bool{}
			for page := 1; page <= 3; page++ {
				for _, item := range e.DoPageItems(fmt.Sprintf("/api/closed-tickets?sort=%s&direction=%s&page=%d", column, direction, page), c.supToken) {
					if seen[id(item)] {
						t.Fatalf("%s %s: ticket %d repeats in page %d", column, direction, id(item), page)
					}
					seen[id(item)] = true
				}
			}
			if len(seen) != 49 {
				t.Fatalf("%s %s: %d tickets in 3 pages, want 49", column, direction, len(seen))
			}
		}
	}
	// Filters and page together: the total follows the filter.
	_, resp := e.DoPage("/api/closed-tickets?subject=assunto&page=2", c.supToken)
	if resp.Body["total"] != float64(45) || resp.Body["page"] != float64(2) {
		t.Errorf("filtered page = %v", resp.Body)
	}
}

func TestClosedTicketsShowWhatEachRowNeeds(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	byProtocol := map[string]map[string]any{}
	for _, item := range c.e.DoPageItems("/api/closed-tickets", c.adminToken) {
		byProtocol[item["protocol"].(string)] = item
	}

	a := byProtocol["9001-000001"]
	if a["id"] != float64(c.closedToday) || a["closureType"] != "resolved" || a["closedAt"] == nil || a["subject"] != "Contracheque atrasado" ||
		a["organizationName"] != "Prefeitura de Campinas" || a["municipalityName"] != "Itu" || a["transferredTo"] != nil {
		t.Fatalf("a = %v", a)
	}
	if contact, _ := a["contact"].(map[string]any); contact["id"] != float64(c.maria) || contact["phone"] != "5511988887777" {
		t.Fatalf("contact = %v", a["contact"])
	}
	if sector, _ := a["sector"].(map[string]any); sector["id"] != float64(c.sector.ID) || sector["name"] != "Contabilidade" {
		t.Fatalf("sector = %v", a["sector"])
	}
	if assignee, _ := a["assignee"].(map[string]any); assignee["id"] != float64(c.ana.ID) {
		t.Fatalf("assignee = %v", a["assignee"])
	}
	if got := fmt.Sprint(a["modules"]); got != "[Folha]" {
		t.Fatalf("modules = %v", got)
	}
	// Several modules come in alphabetical order.
	if got := fmt.Sprint(byProtocol["9001-000002"]["modules"]); got != "[Folha Patrimônio]" {
		t.Fatalf("modules = %v", got)
	}

	// The cancelled one has no organization, subject or module; the transferred one points to the new sector.
	cancelled := byProtocol["9001-000003"]
	if cancelled["closureType"] != "cancelled" || cancelled["organizationName"] != nil || cancelled["subject"] != nil || fmt.Sprint(cancelled["modules"]) != "[]" {
		t.Fatalf("cancelled = %v", cancelled)
	}
	transferred := byProtocol["9001-000004"]
	if to, _ := transferred["transferredTo"].(map[string]any); transferred["closureType"] != "transferred" || to["id"] != float64(c.rh) || to["name"] != "RH" {
		t.Fatalf("transferred = %v", transferred)
	}
}

// The real flows: a ticket closed by the API, a ticket transferred to another
// sector and a ticket cancelled all show with the real closing moment, even
// when they arrived days before.
func TestClosedTicketsListWhatTheSectorClosed(t *testing.T) {
	t.Parallel()
	c := newSectorTransfer(t)
	e := c.e
	path := "/api/closed-tickets"
	if items := e.DoPageItems(path, c.anaToken); len(items) != 0 {
		t.Fatalf("before closing = %v", items)
	}

	// The ticket arrived three days ago and closes now, with another end informed.
	past := time.Now().Add(-72 * time.Hour).Truncate(time.Minute)
	if _, err := e.Pool.Exec(t.Context(), "update tickets set arrived_at = $2, started_at = $2 where id = $1", c.ticket.ID, past); err != nil {
		t.Fatal(err)
	}
	form := with(with(c.form(c.org), "startedAt", past), "endedAt", past.Add(time.Hour))
	if resp := e.closeForm(c.ticket.ID, c.anaToken, form); resp.Status != http.StatusOK {
		t.Fatalf("close: status %d, body %v", resp.Status, resp.Body)
	}

	// The one transferred to another sector stays at the origin, identified.
	moved := e.queuedTicket(c.sector.ID, "MSG-2", "5511977776666")
	if resp := e.assign(moved.ID, c.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, fmt.Sprintf("/api/contacts/%d", moved.ContactID), c.anaToken,
		map[string]any{"name": "Rui", "phone": "5511977776666", "organizationId": c.org, "sectorIds": []int64{c.sector.ID}}); resp.Status != http.StatusOK {
		t.Fatalf("register contact: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.transferSector(moved.ID, c.anaToken, c.transferForm(c.rh)); resp.Status != http.StatusOK {
		t.Fatalf("transfer: status %d, body %v", resp.Status, resp.Body)
	}

	// The one cancelled from the queue.
	cancelled := e.queuedTicket(c.sector.ID, "MSG-3", "5511966665555")
	if resp := e.cancel(cancelled.ID, c.supToken, "Engano."); resp.Status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.Status, resp.Body)
	}

	// An open ticket never shows.
	e.queuedTicket(c.sector.ID, "MSG-4", "5511955554444")

	for _, token := range []string{c.anaToken, c.biaToken, c.supToken, c.adminToken} {
		items := e.DoPageItems(path+"?period=today", token)
		if len(items) != 3 {
			t.Fatalf("closed today = %v, want 3", items)
		}
		kinds := map[float64]string{}
		for _, item := range items {
			kinds[item["id"].(float64)], _ = item["closureType"].(string)
		}
		if kinds[float64(c.ticket.ID)] != "resolved" || kinds[float64(moved.ID)] != "transferred" || kinds[float64(cancelled.ID)] != "cancelled" {
			t.Fatalf("kinds = %v", kinds)
		}
	}
	items := e.DoPageItems(path+"?period=today", c.supToken)
	for _, item := range items {
		if item["id"] == float64(moved.ID) {
			if to, _ := item["transferredTo"].(map[string]any); to["id"] != float64(c.rh) {
				t.Fatalf("transferred to = %v", item["transferredTo"])
			}
		}
	}
	// The destination only sees its own queue, which is not closed.
	if items := e.DoPageItems(path, c.rhToken); len(items) != 0 {
		t.Fatalf("destination = %v", items)
	}
}

func TestClosedTicketFilterOptions(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	e := c.e
	options := func(token, query string) (assignees, modules []string, status int) {
		resp := e.Do(http.MethodGet, "/api/closed-tickets/filters"+query, token, nil)
		for _, key := range []string{"assignees", "modules"} {
			list, _ := resp.Body[key].([]any)
			var names []string
			for _, item := range list {
				names = append(names, item.(map[string]any)["name"].(string))
			}
			if key == "assignees" {
				assignees = names
			} else {
				modules = names
			}
		}
		return assignees, modules, resp.Status
	}

	// The agent too: the filters are for every role of the sector, with the modules that are no longer active.
	for _, token := range []string{c.anaToken, c.supToken} {
		assignees, modules, status := options(token, "")
		if status != http.StatusOK || len(assignees) == 0 || !slices.Contains(modules, "Antigo") || !slices.Contains(modules, "Folha") {
			t.Fatalf("options = %v, %v (%d)", assignees, modules, status)
		}
		if len(modules) != 3 {
			t.Fatalf("modules = %v, want Folha, Patrimônio and Antigo", modules)
		}
	}
	// The admin has no assignee or module before choosing a sector, then gets the ones of the sector.
	assignees, modules, status := options(c.adminToken, "")
	if status != http.StatusOK || len(assignees) != 0 || len(modules) != 0 {
		t.Fatalf("admin without sector = %v, %v (%d)", assignees, modules, status)
	}
	if _, modules, status := options(c.adminToken, qs("sectorId", fmt.Sprint(c.rh))); status != http.StatusOK || fmt.Sprint(modules) != "[Folha]" {
		t.Fatalf("admin of RH = %v (%d)", modules, status)
	}
	// Another sector is refused to the others.
	if _, _, status := options(c.anaToken, qs("sectorId", fmt.Sprint(c.rh))); status != http.StatusForbidden {
		t.Fatalf("other sector: status %d", status)
	}
	if _, _, status := options(c.adminToken, qs("sectorId", "9999")); status != http.StatusBadRequest {
		t.Fatalf("unknown sector: status %d", status)
	}
	if _, _, status := options("", ""); status != http.StatusUnauthorized {
		t.Fatalf("no session: status %d", status)
	}
}

func TestClosedTicketSubjectSuggestions(t *testing.T) {
	t.Parallel()
	c := newClosedList(t)
	e := c.e
	suggestions := func(token, query string) []string {
		return e.DoStrings("/api/closed-tickets/subjects"+query, token)
	}
	want := func(got []string, subjects ...string) {
		t.Helper()
		if !slices.Equal(got, subjects) {
			t.Errorf("suggestions = %v, want %v", got, subjects)
		}
	}
	// The sector of the user: contains, without accents or case, in alphabetical order.
	want(suggestions(c.supToken, ""), "Contracheque atrasado", "Férias", "Imposto de renda")
	want(suggestions(c.supToken, qs("q", "FERIAS")), "Férias")
	want(suggestions(c.supToken, qs("q", "e")), "Contracheque atrasado", "Férias", "Imposto de renda")
	want(suggestions(c.supToken, qs("q", "admiss")))
	want(suggestions(c.rhToken, ""), "Admissão")
	// The admin sees every sector, or the one chosen.
	want(suggestions(c.adminToken, ""), "Admissão", "Contracheque atrasado", "Férias", "Imposto de renda")
	want(suggestions(c.adminToken, qs("sectorId", fmt.Sprint(c.rh))), "Admissão")
	if resp := e.Do(http.MethodGet, "/api/closed-tickets/subjects"+qs("sectorId", fmt.Sprint(c.rh)), c.anaToken, nil); resp.Status != http.StatusForbidden {
		t.Errorf("other sector: status %d", resp.Status)
	}
}
