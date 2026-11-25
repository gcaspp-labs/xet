package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

// setPendingAt moves the moment the ticket was marked pending, which the API
// never changes, to fix the order of the board.
func (d *dashboardFixture) setPendingAt(ticketID int64, at time.Time) {
	d.e.T.Helper()
	if _, err := d.e.Pool.Exec(d.e.T.Context(), "update tickets set pending_at = $2 where id = $1", ticketID, at); err != nil {
		d.e.T.Fatal(err)
	}
}

// pendingBoard is the Pendentes board of the Dashboard: the count of everything
// pending now and the 10 waiting for longer, oldest first, in the sector scope of
// the rest of the Dashboard (spec #332, #342).
func TestDashboardPendingBoard(t *testing.T) {
	d := newDashboard(t)
	at := time.Now().Add(-time.Hour)

	var contab []ticketRow
	for i := 0; i < 12; i++ {
		ticket := d.assigned(d.contab.ID, d.orgA, d.anaToken)
		if resp := d.e.markPending(ticket.ID, d.anaToken, fmt.Sprintf("Aguardando o item %d", i)); resp.Status != http.StatusOK {
			t.Fatalf("mark pending: %d %v", resp.Status, resp.Body)
		}
		// O primeiro é o que está parado há mais tempo.
		d.setPendingAt(ticket.ID, at.Add(-time.Duration(12-i)*time.Minute))
		contab = append(contab, ticket)
	}
	rh := d.assigned(d.rh.ID, d.orgB, d.rhToken)
	if resp := d.e.markPending(rh.ID, d.rhToken, "Aguardando o ponto"); resp.Status != http.StatusOK {
		t.Fatalf("mark pending: %d %v", resp.Status, resp.Body)
	}
	d.setPendingAt(rh.ID, at.Add(-2*time.Hour))

	board := func(path, token string) (int64, []any) {
		t.Helper()
		resp := d.e.Do(http.MethodGet, path, token, nil)
		if resp.Status != http.StatusOK {
			t.Fatalf("%s: status %d, body %v", path, resp.Status, resp.Body)
		}
		count, ok := resp.Body["count"].(float64)
		if !ok {
			t.Fatalf("%s: count = %v", path, resp.Body["count"])
		}
		tickets, ok := resp.Body["tickets"].([]any)
		if !ok {
			t.Fatalf("%s: tickets = %v", path, resp.Body["tickets"])
		}
		return int64(count), tickets
	}

	// O supervisor vê o próprio setor: 12 pendentes, os 10 mais antigos, o primeiro primeiro.
	count, tickets := board("/api/dashboard/pending", d.supToken)
	if count != 12 || len(tickets) != 10 {
		t.Fatalf("supervisor: count %d, %d tickets", count, len(tickets))
	}
	for i, ticket := range contab[:10] {
		row := tickets[i].(map[string]any)
		if row["id"] != float64(ticket.ID) || row["protocol"] != ticket.Protocol {
			t.Fatalf("row %d = %v, want ticket %d", i, row, ticket.ID)
		}
		if row["reason"] != fmt.Sprintf("Aguardando o item %d", i) {
			t.Errorf("row %d reason = %v", i, row["reason"])
		}
		if row["pendingBy"] == nil || row["pendingAt"] == nil || row["sector"] == nil {
			t.Errorf("row %d without who, when or sector: %v", i, row)
		}
	}
	// Atendente não tem Dashboard, e o supervisor não pede outro setor.
	if got := d.e.Do(http.MethodGet, "/api/dashboard/pending", d.anaToken, nil).Status; got != http.StatusForbidden {
		t.Errorf("agent: %d", got)
	}
	if got := d.e.Do(http.MethodGet, fmt.Sprintf("/api/dashboard/pending?sectorId=%d", d.rh.ID), d.supToken, nil).Status; got != http.StatusForbidden {
		t.Errorf("supervisor of the other sector: %d", got)
	}

	// O período dos números não muda o quadro: os pendentes são os de agora.
	for _, path := range []string{
		"/api/dashboard/pending?period=7d",
		"/api/dashboard/pending?from=2020-01-01&to=2020-01-02",
	} {
		if got, rows := board(path, d.supToken); got != 12 || len(rows) != 10 {
			t.Errorf("%s: count %d, %d tickets", path, got, len(rows))
		}
	}

	// O administrador sem setor vê todos: o mais antigo, do RH, vem primeiro.
	count, tickets = board("/api/dashboard/pending", d.adminToken)
	if count != 13 || len(tickets) != 10 {
		t.Fatalf("administrator: count %d, %d tickets", count, len(tickets))
	}
	first := tickets[0].(map[string]any)
	if first["id"] != float64(rh.ID) || first["sector"].(map[string]any)["id"] != float64(d.rh.ID) {
		t.Fatalf("administrator first row = %v, want the RH ticket %d", first, rh.ID)
	}
	// Com o setor escolhido, só os dele.
	count, tickets = board(fmt.Sprintf("/api/dashboard/pending?sectorId=%d", d.contab.ID), d.adminToken)
	if count != 12 || len(tickets) != 10 || tickets[0].(map[string]any)["id"] != float64(contab[0].ID) {
		t.Fatalf("administrator with the sector: count %d, rows %v", count, tickets)
	}
	if got := d.e.Do(http.MethodGet, "/api/dashboard/pending?sectorId=9999", d.adminToken, nil).Status; got != http.StatusBadRequest {
		t.Errorf("unknown sector: %d", got)
	}
}
