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

func TestSectorEmail(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	// Sem espaços nas pontas e como foi digitado.
	resp := e.Do(http.MethodPost, "/api/sectors", token, map[string]string{"name": "Contabilidade", "email": "  Contab@Exemplo.com "})
	if resp.Status != http.StatusCreated || resp.Body["email"] != "Contab@Exemplo.com" {
		t.Fatalf("create with email: status %d, body %v", resp.Status, resp.Body)
	}
	contabID := id(resp.Body)

	// Sem e-mail, com o campo vazio ou só com espaços: grava nulo, e os setores convivem.
	for name, body := range map[string]map[string]string{
		"Sem campo": {"name": "Sem campo"},
		"Vazio":     {"name": "Vazio", "email": ""},
		"Espaços":   {"name": "Espaços", "email": "   "},
	} {
		resp := e.Do(http.MethodPost, "/api/sectors", token, body)
		if resp.Status != http.StatusCreated || resp.Body["email"] != nil {
			t.Fatalf("%s: status %d, body %v", name, resp.Status, resp.Body)
		}
	}
	var empty int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from sectors where email is null").Scan(&empty); err != nil || empty != 3 {
		t.Fatalf("sectors with null email = %d (%v), want 3", empty, err)
	}

	rh := e.Do(http.MethodPost, "/api/sectors", token, map[string]string{"name": "RH"})
	if rh.Status != http.StatusCreated || rh.Body["email"] != nil {
		t.Fatalf("create RH: status %d, body %v", rh.Status, rh.Body)
	}
	rhID := id(rh.Body)
	rhPath := fmt.Sprintf("/api/sectors/%d", rhID)

	refused := []struct {
		name         string
		method, path string
		body         map[string]string
		want         int
		message      string
	}{
		{"create invalid", http.MethodPost, "/api/sectors", map[string]string{"name": "Novo", "email": "sem-arroba"}, http.StatusUnprocessableEntity, "Informe um e-mail válido."},
		{"update invalid", http.MethodPut, rhPath, map[string]string{"name": "RH", "email": "rh@"}, http.StatusUnprocessableEntity, "Informe um e-mail válido."},
		{"create repeated", http.MethodPost, "/api/sectors", map[string]string{"name": "Novo", "email": "CONTAB@exemplo.COM"}, http.StatusConflict, "Já existe um setor com este e-mail."},
		{"update repeated", http.MethodPut, rhPath, map[string]string{"name": "RH", "email": "contab@EXEMPLO.com"}, http.StatusConflict, "Já existe um setor com este e-mail."},
	}
	for _, tc := range refused {
		resp := e.Do(tc.method, tc.path, token, tc.body)
		if resp.Status != tc.want || resp.Body["error"] != tc.message {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.Status, tc.want, resp.Body)
		}
	}
	if actions, _ := e.AuditChanges("sector", rhID); len(actions) != 1 {
		t.Fatalf("refused updates must not be audited: %v", actions)
	}

	// Preencher, trocar e limpar.
	steps := []struct {
		name  string
		email string
		want  any
	}{
		{"fill", " rh@exemplo.com ", "rh@exemplo.com"},
		{"change", "pessoas@exemplo.com", "pessoas@exemplo.com"},
		{"clear", "  ", nil},
	}
	for _, step := range steps {
		resp := e.Do(http.MethodPut, rhPath, token, map[string]string{"name": "RH", "email": step.email})
		if resp.Status != http.StatusOK || resp.Body["email"] != step.want {
			t.Fatalf("%s: status %d, body %v", step.name, resp.Status, resp.Body)
		}
	}

	// O próprio setor pode salvar o mesmo e-mail, e salvar sem mudança não gera auditoria.
	contabPath := fmt.Sprintf("/api/sectors/%d", contabID)
	resp = e.Do(http.MethodPut, contabPath, token, map[string]string{"name": "Contabilidade", "email": "Contab@Exemplo.com"})
	if resp.Status != http.StatusOK || resp.Body["email"] != "Contab@Exemplo.com" {
		t.Fatalf("save without changes: status %d, body %v", resp.Status, resp.Body)
	}
	// E-mail liberado ao limpar pode ser usado por outro setor.
	resp = e.Do(http.MethodPost, "/api/sectors", token, map[string]string{"name": "Pessoas", "email": "pessoas@exemplo.com"})
	if resp.Status != http.StatusCreated {
		t.Fatalf("reuse cleared email: status %d, body %v", resp.Status, resp.Body)
	}

	list := e.DoList(http.MethodGet, "/api/sectors", token)
	if list[0]["name"] != "Contabilidade" || list[0]["email"] != "Contab@Exemplo.com" {
		t.Fatalf("list: %v", list[0])
	}

	actions, changes := e.AuditChanges("sector", contabID)
	if len(actions) != 1 || changes[0]["email"]["from"] != nil || changes[0]["email"]["to"] != "Contab@Exemplo.com" {
		t.Fatalf("contabilidade audit: %v %v", actions, changes)
	}
	actions, changes = e.AuditChanges("sector", rhID)
	if len(actions) != 4 || actions[0] != "sector_created" || actions[3] != "sector_updated" {
		t.Fatalf("rh audit actions: %v", actions)
	}
	if _, ok := changes[0]["email"]; ok {
		t.Fatalf("created without email must not record it: %v", changes[0])
	}
	wantChanges := []struct{ from, to any }{
		{nil, "rh@exemplo.com"},
		{"rh@exemplo.com", "pessoas@exemplo.com"},
		{"pessoas@exemplo.com", nil},
	}
	for i, want := range wantChanges {
		got := changes[i+1]
		if len(got) != 1 || got["email"]["from"] != want.from || got["email"]["to"] != want.to {
			t.Errorf("update %d changes: %v, want %v", i, got, want)
		}
	}
}

func TestOnlyAdminChangesSectorEmail(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)

	path := fmt.Sprintf("/api/sectors/%d", contab.ID)
	body := map[string]string{"name": "Contabilidade", "email": "contab@exemplo.com"}
	cases := []struct {
		who   string
		token string
		want  int
	}{
		{"supervisor", e.Login("sup@exemplo.com", testPassword), http.StatusForbidden},
		{"agent", e.Login("agente@exemplo.com", testPassword), http.StatusForbidden},
		{"none", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		if resp := e.Do(http.MethodPut, path, tc.token, body); resp.Status != tc.want {
			t.Errorf("%s PUT: status %d, want %d", tc.who, resp.Status, tc.want)
		}
		if resp := e.Do(http.MethodPost, "/api/sectors", tc.token, body); resp.Status != tc.want {
			t.Errorf("%s POST: status %d, want %d", tc.who, resp.Status, tc.want)
		}
	}
	var email *string
	if err := e.Pool.QueryRow(t.Context(), "select email from sectors where id = $1", contab.ID).Scan(&email); err != nil || email != nil {
		t.Fatalf("email = %v (%v), want null", email, err)
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
