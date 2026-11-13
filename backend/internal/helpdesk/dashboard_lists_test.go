package helpdesk_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

func TestDashboardListsShowMostRecentAssignmentAfterReturn(t *testing.T) {
	d := newDashboard(t)
	ticket := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	old := time.Now().Add(-24 * time.Hour)
	d.setTimes(ticket.ID, ticketTimes{assigned: &old})
	if resp := d.e.returnToQueue(ticket.ID, d.anaToken); resp.Status != http.StatusOK {
		t.Fatalf("return: %v", resp.Body)
	}
	before := time.Now().Add(-time.Minute)
	if resp := d.e.assign(ticket.ID, d.biaToken); resp.Status != http.StatusOK {
		t.Fatalf("assign: %v", resp.Body)
	}
	resp := d.e.Do(http.MethodGet, "/api/dashboard/tickets", d.supToken, nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("status: %d", resp.Status)
	}
	rows := resp.Body["inProgress"].([]any)
	got, err := time.Parse(time.RFC3339Nano, rows[0].(map[string]any)["assignedAt"].(string))
	if err != nil || got.Before(before) {
		t.Fatalf("assignedAt = %v, err %v", got, err)
	}
}

func TestDashboardListsAccessAndFilters(t *testing.T) {
	d := newDashboard(t)
	queued := d.received(d.contab.ID, d.orgA)
	d.received(d.rh.ID, d.orgB)
	assigned := d.assigned(d.contab.ID, d.orgA, d.anaToken)
	d.assigned(d.contab.ID, d.orgB, d.biaToken)
	path := fmt.Sprintf("/api/dashboard/tickets?sectorId=%d&organizationId=%d&assigneeId=%d&period=30d", d.contab.ID, d.orgA, d.ana.ID)
	resp := d.e.Do(http.MethodGet, path, d.supToken, nil)
	if resp.Status != http.StatusOK {
		t.Fatalf("status %d: %v", resp.Status, resp.Body)
	}
	for key, id := range map[string]int64{"queued": queued.ID, "inProgress": assigned.ID} {
		rows, ok := resp.Body[key].([]any)
		if !ok || len(rows) != 1 || rows[0].(map[string]any)["id"] != float64(id) {
			t.Errorf("%s: got %v, want ticket %d", key, resp.Body[key], id)
		}
	}
	all := d.e.Do(http.MethodGet, "/api/dashboard/tickets", d.adminToken, nil)
	if all.Status != http.StatusOK || len(all.Body["queued"].([]any)) != 2 || len(all.Body["inProgress"].([]any)) != 2 {
		t.Errorf("administrator sees all sectors: %d %v", all.Status, all.Body)
	}
	supervisor := d.e.Do(http.MethodGet, "/api/dashboard/tickets", d.supToken, nil)
	if supervisor.Status != http.StatusOK || len(supervisor.Body["queued"].([]any)) != 1 || len(supervisor.Body["inProgress"].([]any)) != 2 {
		t.Errorf("supervisor sees own sector: %d %v", supervisor.Status, supervisor.Body)
	}
	if got := d.e.Do(http.MethodGet, "/api/dashboard/tickets", d.anaToken, nil).Status; got != http.StatusForbidden {
		t.Errorf("agent: %d", got)
	}
	if got := d.e.Do(http.MethodGet, fmt.Sprintf("/api/dashboard/tickets?sectorId=%d", d.rh.ID), d.supToken, nil).Status; got != http.StatusForbidden {
		t.Errorf("other sector: %d", got)
	}
}
