package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
)

// Os dois históricos alcançam chamados antigos sem vazar o outro setor.
func TestHistoriesBeyondTwoHundred(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	c.register()
	c.e.closeTicket(c.ticket.ID, c.ana.ID, c.org)
	rh := *c.e.userSector("rh@exemplo.com")
	_, err := c.e.Pool.Exec(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id,
		    arrived_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution)
		select '9900-' || lpad(n::text, 6, '0'),
		    case when n <= 205 then $1::bigint else $2::bigint end, $3, $4, 'closed', $5,
		    now() - (300-n) * interval '1 minute', now() - (300-n) * interval '1 minute',
		    now(), now(), $5, 'resolved', 'Assunto', 'Resolvido'
		from generate_series(1, 210) n`, c.sector.ID, rh, c.ticket.ContactID, c.org, c.ana.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, base := range []string{
		fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID),
		fmt.Sprintf("/api/organizations/%d/tickets", c.org),
	} {
		for _, tc := range []struct {
			query string
			first string
		}{
			{"?sort=protocol&direction=desc", "9900-000205"},
			{"?sort=protocol&direction=asc&page=999", "9900-000200"},
			{"?sort=arrived&direction=asc", "9900-000001"},
			{"?sort=invalid&direction=asc&page=999", "9900-000006"},
		} {
			items := c.e.DoPageItems(base+tc.query, c.anaToken)
			if len(items) == 0 || items[0]["protocol"] != tc.first {
				t.Errorf("%s%s: primeira linha %v, esperado %s", base, tc.query, items, tc.first)
			}
		}
		// Todos os chamados do setor empatam nessas colunas; o id define
		// a ordem estável mesmo atravessando páginas.
		for _, column := range []string{"contact", "sector", "assignee", "status"} {
			for _, direction := range []string{"asc", "desc"} {
				var previous int64
				for page := 1; page <= 11; page++ {
					path := fmt.Sprintf("%s?sort=%s&direction=%s&page=%d", base, column, direction, page)
					for _, item := range c.e.DoPageItems(path, c.anaToken) {
						current := id(item)
						if previous != 0 && ((direction == "asc" && current <= previous) || (direction == "desc" && current >= previous)) {
							t.Fatalf("%s: ids fora de ordem: %d, %d", path, previous, current)
						}
						previous = current
					}
				}
			}
		}
		for _, tc := range []struct {
			token string
			total float64
			page  float64
			count int
		}{
			{c.anaToken, 206, 11, 6},
			{c.rhToken, 5, 1, 5},
			{c.adminToken, 211, 11, 11},
		} {
			resp := c.e.Do(http.MethodGet, base+"?page=999", tc.token, nil)
			items, ok := resp.Body["items"].([]any)
			if resp.Status != http.StatusOK || !ok || len(items) != tc.count || resp.Body["total"] != tc.total || resp.Body["page"] != tc.page {
				t.Errorf("%s: status %d, body %v", base, resp.Status, resp.Body)
			}
			if tc.token != c.rhToken && ok && len(items) > 0 && items[len(items)-1].(map[string]any)["protocol"] != "9900-000001" {
				t.Errorf("%s: oldest ticket missing: %v", base, items)
			}
		}
	}
}

// O histórico devolve uma página, contando apenas chamados do setor autorizado.
func TestContactHistoryPage(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	path := fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID)
	resp := c.e.Do(http.MethodGet, path, c.anaToken, nil)
	if resp.Status != http.StatusOK || resp.Body["total"] != float64(1) || resp.Body["page"] != float64(1) {
		t.Fatalf("history: status %d, body %v", resp.Status, resp.Body)
	}
	items, ok := resp.Body["items"].([]any)
	if !ok || len(items) != 1 {
		t.Fatalf("history items: %v", resp.Body["items"])
	}
}
