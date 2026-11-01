package sectors_test

import (
	"fmt"
	"net/http"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestAdminCreatesAndEditsSectors(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	resp := e.Do(http.MethodPost, "/api/sectors", token, map[string]string{"name": " Contabilidade "})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	if resp.Body["name"] != "Contabilidade" || resp.Body["phone"] != nil || resp.Body["provider"] != "whatsmeow" || resp.Body["connectionStatus"] != "disconnected" {
		t.Fatalf("create body: %v", resp.Body)
	}
	contabID := id(resp.Body)

	cases := []struct {
		name string
		body map[string]string
		want int
	}{
		{"duplicate name", map[string]string{"name": "Contabilidade"}, http.StatusConflict},
		{"blank name", map[string]string{"name": "   "}, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		resp := e.Do(http.MethodPost, "/api/sectors", token, tc.body)
		if resp.Status != tc.want || resp.Body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.Status, tc.want, resp.Body)
		}
	}

	rh := e.Do(http.MethodPost, "/api/sectors", token, map[string]string{"name": "RH"})
	if rh.Status != http.StatusCreated {
		t.Fatalf("create RH: status %d", rh.Status)
	}

	path := fmt.Sprintf("/api/sectors/%d", contabID)
	resp = e.Do(http.MethodPut, path, token, map[string]string{"name": "Contabilidade Pública"})
	if resp.Status != http.StatusOK || resp.Body["name"] != "Contabilidade Pública" {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]string{"name": "RH"}); resp.Status != http.StatusConflict {
		t.Fatalf("update to existing name: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, "/api/sectors/999999", token, map[string]string{"name": "X"}); resp.Status != http.StatusNotFound {
		t.Fatalf("update unknown sector: status %d", resp.Status)
	}
	// Saving without changes does not record an audit log.
	if resp := e.Do(http.MethodPut, path, token, map[string]string{"name": "Contabilidade Pública"}); resp.Status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.Status)
	}

	list := e.DoList(http.MethodGet, "/api/sectors", token)
	if len(list) != 2 || list[0]["name"] != "Contabilidade Pública" || list[1]["name"] != "RH" {
		t.Fatalf("list: %v", list)
	}

	actions, changes := e.AuditChanges("sector", contabID)
	if len(actions) != 2 || actions[0] != "sector_created" || actions[1] != "sector_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[0]["name"]["to"] != "Contabilidade" || changes[0]["phone"] != nil {
		t.Fatalf("created changes: %v", changes[0])
	}
	if len(changes[1]) != 1 || changes[1]["name"]["from"] != "Contabilidade" || changes[1]["name"]["to"] != "Contabilidade Pública" {
		t.Fatalf("updated changes: %v", changes[1])
	}
	var actor int64
	if err := e.Pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'sector' and entity_id = $1 limit 1", contabID).Scan(&actor); err != nil || actor != admin.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, admin.ID)
	}
}

func TestSectorListIsLimitedToOwnSector(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.Sector("RH")
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)

	for _, email := range []string{"agente@exemplo.com", "sup@exemplo.com"} {
		list := e.DoList(http.MethodGet, "/api/sectors", e.Login(email, testPassword))
		if len(list) != 1 || list[0]["name"] != "Contabilidade" {
			t.Fatalf("%s sees %v, want only Contabilidade", email, list)
		}
	}
}

func TestConcurrentSectorCreationKeepsNameUnique(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	const n = 8
	statuses := make([]int, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			body := map[string]string{"name": "Contabilidade"}
			statuses[i] = e.Do(http.MethodPost, "/api/sectors", token, body).Status
		})
	}
	wg.Wait()

	created := 0
	for _, s := range statuses {
		switch s {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Fatalf("unexpected status %d", s)
		}
	}
	if created != 1 {
		t.Fatalf("created = %d, want 1 (statuses %v)", created, statuses)
	}
}

func TestModulePermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	tokens := map[string]string{
		"admin":      e.Login("admin@exemplo.com", testPassword),
		"supervisor": e.Login("sup@exemplo.com", testPassword),
		"agent":      e.Login("agente@exemplo.com", testPassword),
		"none":       "",
	}

	cases := []struct {
		who    string
		sector int64
		want   int
	}{
		{"supervisor", contab.ID, http.StatusCreated},
		{"supervisor", rh.ID, http.StatusForbidden},
		{"admin", rh.ID, http.StatusCreated},
		{"agent", contab.ID, http.StatusForbidden},
		{"none", contab.ID, http.StatusUnauthorized},
	}
	for i, tc := range cases {
		path := fmt.Sprintf("/api/sectors/%d/modules", tc.sector)
		body := map[string]string{"name": fmt.Sprintf("Módulo %d", i)}
		if resp := e.Do(http.MethodPost, path, tokens[tc.who], body); resp.Status != tc.want {
			t.Errorf("%s POST %s: status %d, want %d", tc.who, path, resp.Status, tc.want)
		}
		listWant := tc.want
		if listWant == http.StatusCreated {
			listWant = http.StatusOK
		}
		if resp := e.Do(http.MethodGet, path, tokens[tc.who], nil); resp.Status != listWant {
			t.Errorf("%s GET %s: status %d, want %d", tc.who, path, resp.Status, listWant)
		}
	}

	rhModule := e.DoList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/modules", rh.ID), tokens["admin"])[0]
	// A module of another sector is not reachable through the supervisor's own sector.
	path := fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, id(rhModule))
	if resp := e.Do(http.MethodPut, path, tokens["supervisor"], map[string]any{"name": "Invadido", "active": false}); resp.Status != http.StatusNotFound {
		t.Fatalf("update module of other sector: status %d", resp.Status)
	}
	path = fmt.Sprintf("/api/sectors/%d/modules/%d", rh.ID, id(rhModule))
	if resp := e.Do(http.MethodPut, path, tokens["supervisor"], map[string]any{"name": "Invadido", "active": false}); resp.Status != http.StatusForbidden {
		t.Fatalf("supervisor updating other sector: status %d", resp.Status)
	}
}

func TestSupervisorManagesModules(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.Login("sup@exemplo.com", testPassword)
	base := fmt.Sprintf("/api/sectors/%d/modules", contab.ID)

	resp := e.Do(http.MethodPost, base, token, map[string]string{"name": " Folha de pagamento "})
	if resp.Status != http.StatusCreated || resp.Body["name"] != "Folha de pagamento" || resp.Body["active"] != true {
		t.Fatalf("create: status %d, body %v", resp.Status, resp.Body)
	}
	folhaID := id(resp.Body)
	if resp := e.Do(http.MethodPost, base, token, map[string]string{"name": "Contabilidade geral"}); resp.Status != http.StatusCreated {
		t.Fatalf("create second: status %d", resp.Status)
	}

	if resp := e.Do(http.MethodPost, base, token, map[string]string{"name": "FOLHA DE PAGAMENTO"}); resp.Status != http.StatusConflict {
		t.Fatalf("duplicate ignoring case: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPost, base, token, map[string]string{"name": "  "}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("blank name: status %d", resp.Status)
	}
	// The same name is allowed in another sector.
	adminToken := e.Login("admin@exemplo.com", testPassword)
	if resp := e.Do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", rh.ID), adminToken, map[string]string{"name": "Folha de pagamento"}); resp.Status != http.StatusCreated {
		t.Fatalf("same name in other sector: status %d", resp.Status)
	}

	path := fmt.Sprintf("%s/%d", base, folhaID)
	resp = e.Do(http.MethodPut, path, token, map[string]any{"name": "Folha", "active": false})
	if resp.Status != http.StatusOK || resp.Body["name"] != "Folha" || resp.Body["active"] != false {
		t.Fatalf("rename and deactivate: status %d, body %v", resp.Status, resp.Body)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "Contabilidade geral", "active": false}); resp.Status != http.StatusConflict {
		t.Fatalf("rename to existing: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{"name": "Folha"}); resp.Status != http.StatusUnprocessableEntity {
		t.Fatalf("missing active: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, base+"/999999", token, map[string]any{"name": "X", "active": true}); resp.Status != http.StatusNotFound {
		t.Fatalf("unknown module: status %d", resp.Status)
	}

	// Active modules first, then by name; inactive ones remain listed.
	list := e.DoList(http.MethodGet, base, token)
	if len(list) != 2 || list[0]["name"] != "Contabilidade geral" || list[1]["name"] != "Folha" || list[1]["active"] != false {
		t.Fatalf("list: %v", list)
	}

	resp = e.Do(http.MethodPut, path, token, map[string]any{"name": "Folha", "active": true})
	if resp.Status != http.StatusOK || resp.Body["active"] != true {
		t.Fatalf("reactivate: status %d, body %v", resp.Status, resp.Body)
	}

	actions, changes := e.AuditChanges("module", folhaID)
	if len(actions) != 3 || actions[0] != "module_created" || actions[1] != "module_updated" || actions[2] != "module_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[1]["name"]["from"] != "Folha de pagamento" || changes[1]["active"]["to"] != false {
		t.Fatalf("update changes: %v", changes[1])
	}
	var actor int64
	if err := e.Pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'module' and entity_id = $1 limit 1", folhaID).Scan(&actor); err != nil || actor != sup.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, sup.ID)
	}
}
