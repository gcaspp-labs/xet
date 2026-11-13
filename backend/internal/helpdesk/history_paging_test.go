package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"

	"github.com/jackc/pgx/v5"
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

// As colunas dos dois históricos ordenam os valores exibidos nas duas direções.
func TestHistorySortColumns(t *testing.T) {
	t.Parallel()
	c := newClosing(t)
	c.register()
	rh := *c.e.userSector("rh@exemplo.com")
	var rhUser int64
	if err := c.e.Pool.QueryRow(t.Context(), "select id from users where email = 'rh@exemplo.com'").Scan(&rhUser); err != nil {
		t.Fatal(err)
	}
	_, err := c.e.Pool.Exec(t.Context(), `
		update users set name = case id when $1 then 'Álvaro' else 'bruno' end where id in ($1, $2);
		update tickets set protocol='9000-000002', arrived_at='2020-01-02' where id=$3;
		insert into contacts (name, phone, organization_id, registered) values
		  ('bruno', '5511900010001', $4, true), ('Álvaro', '5511900010002', $4, true);
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id,
		  arrived_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution)
		select v.protocol, v.sector_id, v.contact_id, $4, 'closed', v.assignee_id,
		  v.arrived_at::timestamptz, v.arrived_at::timestamptz, now(), now(), v.assignee_id,
		  v.closure_type::closure_type, 'Assunto', 'Resolvido'
		from (values
		  ('9000-000001', $5::bigint, $6::bigint, $2::bigint, '2020-01-01', 'cancelled'),
		  ('9000-000003', $7::bigint, (select id from contacts where phone='5511900010001'), $1::bigint, '2020-01-03', 'resolved'),
		  ('9000-000004', $5::bigint, (select id from contacts where phone='5511900010002'), $2::bigint, '2020-01-04', 'resolved')
		) v(protocol, sector_id, contact_id, assignee_id, arrived_at, closure_type)`,
		pgx.QueryExecModeSimpleProtocol, c.ana.ID, rhUser, c.ticket.ID, c.org, rh, c.ticket.ContactID, c.sector.ID)
	if err != nil {
		t.Fatal(err)
	}
	contact := fmt.Sprintf("/api/contacts/%d/tickets", c.ticket.ContactID)
	org := fmt.Sprintf("/api/organizations/%d/tickets", c.org)
	for _, tc := range []struct {
		path, column, direction, want string
	}{
		{org, "protocol", "asc", "[9000-000001 9000-000002 9000-000003 9000-000004]"},
		{org, "protocol", "desc", "[9000-000004 9000-000003 9000-000002 9000-000001]"},
		{org, "arrived", "asc", "[9000-000001 9000-000002 9000-000003 9000-000004]"},
		{org, "arrived", "desc", "[9000-000004 9000-000003 9000-000002 9000-000001]"},
		{org, "contact", "asc", "[9000-000004 9000-000003 9000-000002 9000-000001]"},
		{org, "contact", "desc", "[9000-000001 9000-000002 9000-000003 9000-000004]"},
		{org, "sector", "asc", "[9000-000002 9000-000003 9000-000001 9000-000004]"},
		{org, "sector", "desc", "[9000-000004 9000-000001 9000-000003 9000-000002]"},
		{org, "assignee", "asc", "[9000-000002 9000-000003 9000-000001 9000-000004]"},
		{org, "assignee", "desc", "[9000-000004 9000-000001 9000-000003 9000-000002]"},
		{org, "status", "asc", "[9000-000001 9000-000002 9000-000003 9000-000004]"},
		{org, "status", "desc", "[9000-000004 9000-000003 9000-000002 9000-000001]"},
		{contact, "protocol", "asc", "[9000-000001 9000-000002]"},
		{contact, "protocol", "desc", "[9000-000002 9000-000001]"},
		{contact, "arrived", "asc", "[9000-000001 9000-000002]"},
		{contact, "arrived", "desc", "[9000-000002 9000-000001]"},
		{contact, "sector", "asc", "[9000-000002 9000-000001]"},
		{contact, "sector", "desc", "[9000-000001 9000-000002]"},
		{contact, "assignee", "asc", "[9000-000002 9000-000001]"},
		{contact, "assignee", "desc", "[9000-000001 9000-000002]"},
		{contact, "status", "asc", "[9000-000001 9000-000002]"},
		{contact, "status", "desc", "[9000-000002 9000-000001]"},
	} {
		path := fmt.Sprintf("%s?sort=%s&direction=%s", tc.path, tc.column, tc.direction)
		var protocols []string
		for _, item := range c.e.DoPageItems(path, c.adminToken) {
			protocols = append(protocols, item["protocol"].(string))
		}
		if got := fmt.Sprint(protocols); got != tc.want {
			t.Errorf("%s: %s, esperado %s", path, got, tc.want)
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
