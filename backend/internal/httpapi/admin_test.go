package httpapi

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/db"
)

// auditChanges returns the actions and decoded changes recorded for an entity.
func (e *testEnv) auditChanges(entityType string, entityID int64) ([]string, []map[string]map[string]any) {
	e.t.Helper()
	logs, err := e.q.ListAuditLogsByEntity(e.t.Context(), db.ListAuditLogsByEntityParams{EntityType: entityType, EntityID: entityID})
	if err != nil {
		e.t.Fatal(err)
	}
	actions := make([]string, len(logs))
	changes := make([]map[string]map[string]any, len(logs))
	for i, l := range logs {
		actions[i] = l.Action
		if err := json.Unmarshal(l.Changes, &changes[i]); err != nil {
			e.t.Fatalf("audit changes %s: %v", l.Changes, err)
		}
	}
	return actions, changes
}

func id(body map[string]any) int64 {
	v, _ := body["id"].(float64)
	return int64(v)
}

func TestAdministrationRequiresAdmin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	agent := e.user("agente@exemplo.com", db.UserRoleAgent, &contab.ID)

	tokens := map[string]string{
		"supervisor": e.login("sup@exemplo.com", testPassword),
		"agent":      e.login("agente@exemplo.com", testPassword),
	}
	sectorBody := map[string]string{"name": "RH", "phone": "5511999990001"}
	userBody := map[string]any{"name": "Novo", "email": "novo@exemplo.com", "role": "agent", "sectorId": contab.ID, "password": testPassword, "active": true}
	requests := []struct {
		method, path string
		body         any
	}{
		{http.MethodPost, "/api/sectors", sectorBody},
		{http.MethodPut, fmt.Sprintf("/api/sectors/%d", contab.ID), sectorBody},
		{http.MethodGet, "/api/users", nil},
		{http.MethodPost, "/api/users", userBody},
		{http.MethodPut, fmt.Sprintf("/api/users/%d", agent.ID), userBody},
	}
	for _, req := range requests {
		for who, token := range tokens {
			if resp := e.do(req.method, req.path, token, req.body); resp.status != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d, want 403", who, req.method, req.path, resp.status)
			}
		}
		if resp := e.do(req.method, req.path, "", req.body); resp.status != http.StatusUnauthorized {
			t.Errorf("no session %s %s: status %d, want 401", req.method, req.path, resp.status)
		}
	}

	var sectors int
	if err := e.pool.QueryRow(t.Context(), "select count(*) from sectors").Scan(&sectors); err != nil {
		t.Fatal(err)
	}
	if sectors != 1 {
		t.Fatalf("sectors = %d, want 1: refused requests must not write", sectors)
	}
}

func TestAdminCreatesAndEditsSectors(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	admin := e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)

	resp := e.do(http.MethodPost, "/api/sectors", token, map[string]string{"name": " Contabilidade ", "phone": "+55 (11) 99999-0000"})
	if resp.status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", resp.status, resp.body)
	}
	if resp.body["name"] != "Contabilidade" || resp.body["phone"] != "5511999990000" || resp.body["provider"] != "whatsmeow" || resp.body["connectionStatus"] != "disconnected" {
		t.Fatalf("create body: %v", resp.body)
	}
	contabID := id(resp.body)

	cases := []struct {
		name string
		body map[string]string
		want int
	}{
		{"duplicate name", map[string]string{"name": "Contabilidade", "phone": "5511999990001"}, http.StatusConflict},
		{"duplicate phone", map[string]string{"name": "RH", "phone": "5511999990000"}, http.StatusConflict},
		{"short phone", map[string]string{"name": "RH", "phone": "119999"}, http.StatusUnprocessableEntity},
		{"phone with letters", map[string]string{"name": "RH", "phone": "55119999A0000"}, http.StatusUnprocessableEntity},
		{"blank name", map[string]string{"name": "   ", "phone": "5511999990001"}, http.StatusUnprocessableEntity},
		{"missing phone", map[string]string{"name": "RH"}, http.StatusUnprocessableEntity},
	}
	for _, tc := range cases {
		resp := e.do(http.MethodPost, "/api/sectors", token, tc.body)
		if resp.status != tc.want || resp.body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.status, tc.want, resp.body)
		}
	}

	rh := e.do(http.MethodPost, "/api/sectors", token, map[string]string{"name": "RH", "phone": "5511999990001"})
	if rh.status != http.StatusCreated {
		t.Fatalf("create RH: status %d", rh.status)
	}

	path := fmt.Sprintf("/api/sectors/%d", contabID)
	resp = e.do(http.MethodPut, path, token, map[string]string{"name": "Contabilidade Pública", "phone": "5511999990000"})
	if resp.status != http.StatusOK || resp.body["name"] != "Contabilidade Pública" {
		t.Fatalf("update: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]string{"name": "RH", "phone": "5511999990000"}); resp.status != http.StatusConflict {
		t.Fatalf("update to existing name: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, "/api/sectors/999999", token, map[string]string{"name": "X", "phone": "5511999990009"}); resp.status != http.StatusNotFound {
		t.Fatalf("update unknown sector: status %d", resp.status)
	}
	// Saving without changes does not record an audit log.
	if resp := e.do(http.MethodPut, path, token, map[string]string{"name": "Contabilidade Pública", "phone": "5511999990000"}); resp.status != http.StatusOK {
		t.Fatalf("update without changes: status %d", resp.status)
	}

	list := e.doList(http.MethodGet, "/api/sectors", token)
	if len(list) != 2 || list[0]["name"] != "Contabilidade Pública" || list[1]["name"] != "RH" {
		t.Fatalf("list: %v", list)
	}

	actions, changes := e.auditChanges("sector", contabID)
	if len(actions) != 2 || actions[0] != "sector_created" || actions[1] != "sector_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[0]["name"]["to"] != "Contabilidade" || changes[0]["phone"]["to"] != "5511999990000" {
		t.Fatalf("created changes: %v", changes[0])
	}
	if len(changes[1]) != 1 || changes[1]["name"]["from"] != "Contabilidade" || changes[1]["name"]["to"] != "Contabilidade Pública" {
		t.Fatalf("updated changes: %v", changes[1])
	}
	var actor int64
	if err := e.pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'sector' and entity_id = $1 limit 1", contabID).Scan(&actor); err != nil || actor != admin.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, admin.ID)
	}
}

func TestSectorListIsLimitedToOwnSector(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	e.sector("RH", "5511999990001")
	e.user("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)

	for _, email := range []string{"agente@exemplo.com", "sup@exemplo.com"} {
		list := e.doList(http.MethodGet, "/api/sectors", e.login(email, testPassword))
		if len(list) != 1 || list[0]["name"] != "Contabilidade" {
			t.Fatalf("%s sees %v, want only Contabilidade", email, list)
		}
	}
}

func TestConcurrentSectorCreationKeepsNameUnique(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)

	const n = 8
	statuses := make([]int, n)
	var wg sync.WaitGroup
	for i := range n {
		wg.Go(func() {
			body := map[string]string{"name": "Contabilidade", "phone": fmt.Sprintf("551199999000%d", i)}
			statuses[i] = e.do(http.MethodPost, "/api/sectors", token, body).status
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

func TestAdminCreatesUsers(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	admin := e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)

	resp := e.do(http.MethodPost, "/api/users", token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "agent", "sectorId": contab.ID, "password": testPassword,
	})
	if resp.status != http.StatusCreated {
		t.Fatalf("create agent: status %d, body %v", resp.status, resp.body)
	}
	if resp.body["role"] != "agent" || resp.body["sectorId"] != float64(contab.ID) || resp.body["active"] != true {
		t.Fatalf("create body: %v", resp.body)
	}
	if _, ok := resp.body["passwordHash"]; ok {
		t.Fatal("response must not contain the password hash")
	}
	anaID := id(resp.body)
	e.login("ana@exemplo.com", testPassword)

	// The sector sent for an admin is ignored: admins have no sector.
	resp = e.do(http.MethodPost, "/api/users", token, map[string]any{
		"name": "Bruno", "email": "bruno@exemplo.com", "role": "admin", "sectorId": contab.ID, "password": testPassword,
	})
	if resp.status != http.StatusCreated || resp.body["sectorId"] != nil {
		t.Fatalf("create admin: status %d, body %v", resp.status, resp.body)
	}

	sector := contab.ID
	unknown := int64(999999)
	cases := []struct {
		name string
		body map[string]any
		want int
	}{
		{"agent without sector", map[string]any{"name": "C", "email": "c@exemplo.com", "role": "agent", "password": testPassword}, http.StatusUnprocessableEntity},
		{"supervisor without sector", map[string]any{"name": "C", "email": "c@exemplo.com", "role": "supervisor", "password": testPassword}, http.StatusUnprocessableEntity},
		{"unknown sector", map[string]any{"name": "C", "email": "c@exemplo.com", "role": "agent", "sectorId": unknown, "password": testPassword}, http.StatusUnprocessableEntity},
		{"unknown role", map[string]any{"name": "C", "email": "c@exemplo.com", "role": "root", "sectorId": sector, "password": testPassword}, http.StatusUnprocessableEntity},
		{"invalid email", map[string]any{"name": "C", "email": "c-exemplo.com", "role": "agent", "sectorId": sector, "password": testPassword}, http.StatusUnprocessableEntity},
		{"blank name", map[string]any{"name": "  ", "email": "c@exemplo.com", "role": "agent", "sectorId": sector, "password": testPassword}, http.StatusUnprocessableEntity},
		{"weak password", map[string]any{"name": "C", "email": "c@exemplo.com", "role": "agent", "sectorId": sector, "password": "abcdefgh"}, http.StatusUnprocessableEntity},
		{"duplicate email ignoring case", map[string]any{"name": "C", "email": "ANA@exemplo.com", "role": "agent", "sectorId": sector, "password": testPassword}, http.StatusConflict},
	}
	for _, tc := range cases {
		resp := e.do(http.MethodPost, "/api/users", token, tc.body)
		if resp.status != tc.want || resp.body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.status, tc.want, resp.body)
		}
	}

	list := e.doList(http.MethodGet, "/api/users", token)
	if len(list) != 3 {
		t.Fatalf("list: %v", list)
	}
	for _, u := range list {
		if _, ok := u["passwordHash"]; ok {
			t.Fatal("list must not contain the password hash")
		}
	}

	actions, changes := e.auditChanges("user", anaID)
	if len(actions) != 1 || actions[0] != "user_created" || changes[0]["email"]["to"] != "ana@exemplo.com" || changes[0]["role"]["to"] != "agent" {
		t.Fatalf("audit: %v %v", actions, changes)
	}
	if _, ok := changes[0]["password"]; ok {
		t.Fatal("audit must not contain the password")
	}
	var actor int64
	if err := e.pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'user' and entity_id = $1", anaID).Scan(&actor); err != nil || actor != admin.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, admin.ID)
	}
}

func TestAdminEditsAndDeactivatesUsers(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	rh := e.sector("RH", "5511999990001")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	ana := e.user("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.login("admin@exemplo.com", testPassword)
	anaToken := e.login("ana@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/users/%d", ana.ID)

	resp := e.do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": true,
	})
	if resp.status != http.StatusOK || resp.body["role"] != "supervisor" || resp.body["sectorId"] != float64(rh.ID) {
		t.Fatalf("update: status %d, body %v", resp.status, resp.body)
	}
	// The new role and sector apply to the open session right away.
	me := e.do(http.MethodGet, "/api/auth/me", anaToken, nil)
	if me.status != http.StatusOK || me.body["role"] != "supervisor" || me.body["sectorId"] != float64(rh.ID) {
		t.Fatalf("me after update: status %d, body %v", me.status, me.body)
	}

	resp = e.do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": false,
	})
	if resp.status != http.StatusOK || resp.body["active"] != false {
		t.Fatalf("deactivate: status %d, body %v", resp.status, resp.body)
	}
	var sessions int
	if err := e.pool.QueryRow(t.Context(), "select count(*) from sessions where user_id = $1", ana.ID).Scan(&sessions); err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatalf("sessions after deactivation = %d, want 0", sessions)
	}
	if resp := e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword}); resp.status != http.StatusUnauthorized {
		t.Fatalf("login of deactivated user: status %d", resp.status)
	}

	resp = e.do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": true,
	})
	if resp.status != http.StatusOK {
		t.Fatalf("reactivate: status %d", resp.status)
	}
	e.login("ana@exemplo.com", testPassword)

	if resp := e.do(http.MethodPut, "/api/users/999999", token, map[string]any{
		"name": "X", "email": "x@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true,
	}); resp.status != http.StatusNotFound {
		t.Fatalf("update unknown user: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]any{
		"name": "Ana", "email": "admin@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true,
	}); resp.status != http.StatusConflict {
		t.Fatalf("update to existing email: status %d", resp.status)
	}

	actions, changes := e.auditChanges("user", ana.ID)
	if len(actions) != 3 || actions[0] != "user_updated" || actions[1] != "user_updated" || actions[2] != "user_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	first := changes[0]
	if first["name"]["from"] != "ana@exemplo.com" || first["name"]["to"] != "Ana Souza" ||
		first["role"]["from"] != "agent" || first["role"]["to"] != "supervisor" ||
		first["sector_id"]["from"] != float64(contab.ID) || first["sector_id"]["to"] != float64(rh.ID) {
		t.Fatalf("first update changes: %v", first)
	}
	if _, ok := first["email"]; ok {
		t.Fatalf("unchanged email recorded: %v", first)
	}
	if len(changes[1]) != 1 || changes[1]["active"]["from"] != true || changes[1]["active"]["to"] != false {
		t.Fatalf("deactivation changes: %v", changes[1])
	}
}

func TestUserWithTicketsInProgressKeepsSectorAndStaysActive(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	rh := e.sector("Recursos", "5511999990002")
	path := fmt.Sprintf("/api/users/%d", c.ana.ID)
	body := func(name, email, role string, sectorID *int64, active bool) map[string]any {
		return map[string]any{"name": name, "email": email, "role": role, "sectorId": sectorID, "active": active}
	}
	email := "ana@exemplo.com"

	c.assign()
	second := e.queuedTicket(c.sector.ID, "MSG-2", "5511988887778")
	if resp := e.assign(second.ID, c.anaToken); resp.status != http.StatusOK {
		t.Fatalf("assign second: status %d", resp.status)
	}

	refused := []struct {
		name string
		body map[string]any
		want string
	}{
		{"deactivate", body("Ana", email, "agent", &c.sector.ID, false), "2 chamados em atendimento"},
		{"change sector", body("Ana", email, "agent", &rh.ID, true), "2 chamados em atendimento"},
		{"become admin", body("Ana", email, "admin", nil, true), "2 chamados em atendimento"},
	}
	for _, tc := range refused {
		resp := e.do(http.MethodPut, path, c.adminToken, tc.body)
		message, _ := resp.body["error"].(string)
		if resp.status != http.StatusConflict || !strings.Contains(message, tc.want) {
			t.Errorf("%s: status %d, body %v", tc.name, resp.status, resp.body)
		}
	}
	actions, _ := e.auditChanges("user", c.ana.ID)
	if len(actions) != 0 {
		t.Fatalf("refused changes recorded in the audit log: %v", actions)
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", c.anaToken, nil); resp.status != http.StatusOK {
		t.Fatalf("session after refused deactivation: status %d", resp.status)
	}

	// O que não tira a pessoa do setor continua livre.
	free := []struct {
		name string
		body map[string]any
	}{
		{"rename and change e-mail", body("Ana Souza", "ana.souza@exemplo.com", "agent", &c.sector.ID, true)},
		{"change role in the sector", body("Ana Souza", "ana.souza@exemplo.com", "supervisor", &c.sector.ID, true)},
	}
	for _, tc := range free {
		if resp := e.do(http.MethodPut, path, c.adminToken, tc.body); resp.status != http.StatusOK {
			t.Errorf("%s: status %d, body %v", tc.name, resp.status, resp.body)
		}
	}
	email = "ana.souza@exemplo.com"

	// Com um chamado só, a mensagem fica no singular.
	bia := e.userID("bia@exemplo.com")
	if resp := e.transfer(c.ticket.ID, bia, c.adminToken); resp.status != http.StatusOK {
		t.Fatalf("transfer first: status %d", resp.status)
	}
	resp := e.do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &c.sector.ID, false))
	if message, _ := resp.body["error"].(string); resp.status != http.StatusConflict || !strings.Contains(message, "1 chamado em atendimento") {
		t.Fatalf("one ticket left: status %d, body %v", resp.status, resp.body)
	}

	// Depois de transferir, as duas mudanças passam.
	if resp := e.transfer(second.ID, bia, c.adminToken); resp.status != http.StatusOK {
		t.Fatalf("transfer second: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &rh.ID, true)); resp.status != http.StatusOK || resp.body["sectorId"] != float64(rh.ID) {
		t.Fatalf("change sector after transfer: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, c.adminToken, body("Ana Souza", email, "supervisor", &rh.ID, false)); resp.status != http.StatusOK || resp.body["active"] != false {
		t.Fatalf("deactivate after transfer: status %d, body %v", resp.status, resp.body)
	}
}

// Só os chamados em atendimento impedem: o encerrado continua com a pessoa
// como responsável, e o devolvido à fila deixa de ter responsável.
func TestClosedAndReturnedTicketsDoNotHoldTheUser(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	path := fmt.Sprintf("/api/users/%d", c.ana.ID)
	deactivate := map[string]any{"name": "Ana", "email": "ana@exemplo.com", "role": "agent", "sectorId": c.sector.ID, "active": false}

	if resp := e.do(http.MethodPut, path, c.adminToken, deactivate); resp.status != http.StatusConflict {
		t.Fatalf("with ticket in progress: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.returnToQueue(c.ticket.ID, c.anaToken); resp.status != http.StatusOK {
		t.Fatalf("return to queue: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.assign(c.ticket.ID, c.anaToken); resp.status != http.StatusOK {
		t.Fatalf("assign again: status %d", resp.status)
	}
	if resp := e.cancel(c.ticket.ID, c.anaToken, "Sem necessidade"); resp.status != http.StatusOK {
		t.Fatalf("cancel: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, c.adminToken, deactivate); resp.status != http.StatusOK {
		t.Fatalf("with closed ticket only: status %d, body %v", resp.status, resp.body)
	}
}

// A transferência para a pessoa trava o usuário de destino: ou a desativação
// vê o chamado e é recusada, ou a transferência vê a pessoa inativa e é recusada.
func TestDeactivationAndConcurrentTransferDoNotLeaveInactiveAssignee(t *testing.T) {
	t.Parallel()
	c := newConversation(t)
	e := c.e
	c.assign()
	bia := e.userID("bia@exemplo.com")
	deactivate := map[string]any{"name": "Bia", "email": "bia@exemplo.com", "role": "agent", "sectorId": c.sector.ID, "active": false}

	var transfer, update response
	var wg sync.WaitGroup
	start := make(chan struct{})
	wg.Go(func() {
		<-start
		transfer = e.transfer(c.ticket.ID, bia, c.anaToken)
	})
	wg.Go(func() {
		<-start
		update = e.do(http.MethodPut, fmt.Sprintf("/api/users/%d", bia), c.adminToken, deactivate)
	})
	close(start)
	wg.Wait()

	switch {
	case transfer.status == http.StatusOK && update.status == http.StatusConflict:
	case transfer.status == http.StatusUnprocessableEntity && update.status == http.StatusOK:
	default:
		t.Fatalf("transfer: status %d, body %v; deactivate: status %d, body %v", transfer.status, transfer.body, update.status, update.body)
	}
}

func TestAdminCannotLockThemselvesOut(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	admin := e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	other := e.user("admin2@exemplo.com", db.UserRoleAdmin, nil)
	token := e.login("admin@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/users/%d", admin.ID)

	cases := []struct {
		name string
		body map[string]any
		want int
	}{
		{"deactivate self", map[string]any{"name": "Admin", "email": "admin@exemplo.com", "role": "admin", "active": false}, http.StatusUnprocessableEntity},
		{"demote self", map[string]any{"name": "Admin", "email": "admin@exemplo.com", "role": "supervisor", "sectorId": contab.ID, "active": true}, http.StatusUnprocessableEntity},
		{"rename self", map[string]any{"name": "Admin Geral", "email": "admin@exemplo.com", "role": "admin", "active": true}, http.StatusOK},
	}
	for _, tc := range cases {
		if resp := e.do(http.MethodPut, path, token, tc.body); resp.status != tc.want {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.status, tc.want, resp.body)
		}
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", token, nil); resp.status != http.StatusOK || resp.body["role"] != "admin" {
		t.Fatalf("admin session after refused changes: status %d, body %v", resp.status, resp.body)
	}

	// Another administrator can be deactivated.
	resp := e.do(http.MethodPut, fmt.Sprintf("/api/users/%d", other.ID), token, map[string]any{
		"name": "Outro", "email": "admin2@exemplo.com", "role": "admin", "active": false,
	})
	if resp.status != http.StatusOK {
		t.Fatalf("deactivate other admin: status %d, body %v", resp.status, resp.body)
	}
}

func TestModulePermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	rh := e.sector("RH", "5511999990001")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("agente@exemplo.com", db.UserRoleAgent, &contab.ID)
	tokens := map[string]string{
		"admin":      e.login("admin@exemplo.com", testPassword),
		"supervisor": e.login("sup@exemplo.com", testPassword),
		"agent":      e.login("agente@exemplo.com", testPassword),
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
		if resp := e.do(http.MethodPost, path, tokens[tc.who], body); resp.status != tc.want {
			t.Errorf("%s POST %s: status %d, want %d", tc.who, path, resp.status, tc.want)
		}
		listWant := tc.want
		if listWant == http.StatusCreated {
			listWant = http.StatusOK
		}
		if resp := e.do(http.MethodGet, path, tokens[tc.who], nil); resp.status != listWant {
			t.Errorf("%s GET %s: status %d, want %d", tc.who, path, resp.status, listWant)
		}
	}

	rhModule := e.doList(http.MethodGet, fmt.Sprintf("/api/sectors/%d/modules", rh.ID), tokens["admin"])[0]
	// A module of another sector is not reachable through the supervisor's own sector.
	path := fmt.Sprintf("/api/sectors/%d/modules/%d", contab.ID, id(rhModule))
	if resp := e.do(http.MethodPut, path, tokens["supervisor"], map[string]any{"name": "Invadido", "active": false}); resp.status != http.StatusNotFound {
		t.Fatalf("update module of other sector: status %d", resp.status)
	}
	path = fmt.Sprintf("/api/sectors/%d/modules/%d", rh.ID, id(rhModule))
	if resp := e.do(http.MethodPut, path, tokens["supervisor"], map[string]any{"name": "Invadido", "active": false}); resp.status != http.StatusForbidden {
		t.Fatalf("supervisor updating other sector: status %d", resp.status)
	}
}

func TestSupervisorManagesModules(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	rh := e.sector("RH", "5511999990001")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	sup := e.user("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	token := e.login("sup@exemplo.com", testPassword)
	base := fmt.Sprintf("/api/sectors/%d/modules", contab.ID)

	resp := e.do(http.MethodPost, base, token, map[string]string{"name": " Folha de pagamento "})
	if resp.status != http.StatusCreated || resp.body["name"] != "Folha de pagamento" || resp.body["active"] != true {
		t.Fatalf("create: status %d, body %v", resp.status, resp.body)
	}
	folhaID := id(resp.body)
	if resp := e.do(http.MethodPost, base, token, map[string]string{"name": "Contabilidade geral"}); resp.status != http.StatusCreated {
		t.Fatalf("create second: status %d", resp.status)
	}

	if resp := e.do(http.MethodPost, base, token, map[string]string{"name": "FOLHA DE PAGAMENTO"}); resp.status != http.StatusConflict {
		t.Fatalf("duplicate ignoring case: status %d", resp.status)
	}
	if resp := e.do(http.MethodPost, base, token, map[string]string{"name": "  "}); resp.status != http.StatusUnprocessableEntity {
		t.Fatalf("blank name: status %d", resp.status)
	}
	// The same name is allowed in another sector.
	adminToken := e.login("admin@exemplo.com", testPassword)
	if resp := e.do(http.MethodPost, fmt.Sprintf("/api/sectors/%d/modules", rh.ID), adminToken, map[string]string{"name": "Folha de pagamento"}); resp.status != http.StatusCreated {
		t.Fatalf("same name in other sector: status %d", resp.status)
	}

	path := fmt.Sprintf("%s/%d", base, folhaID)
	resp = e.do(http.MethodPut, path, token, map[string]any{"name": "Folha", "active": false})
	if resp.status != http.StatusOK || resp.body["name"] != "Folha" || resp.body["active"] != false {
		t.Fatalf("rename and deactivate: status %d, body %v", resp.status, resp.body)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]any{"name": "Contabilidade geral", "active": false}); resp.status != http.StatusConflict {
		t.Fatalf("rename to existing: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, path, token, map[string]any{"name": "Folha"}); resp.status != http.StatusUnprocessableEntity {
		t.Fatalf("missing active: status %d", resp.status)
	}
	if resp := e.do(http.MethodPut, base+"/999999", token, map[string]any{"name": "X", "active": true}); resp.status != http.StatusNotFound {
		t.Fatalf("unknown module: status %d", resp.status)
	}

	// Active modules first, then by name; inactive ones remain listed.
	list := e.doList(http.MethodGet, base, token)
	if len(list) != 2 || list[0]["name"] != "Contabilidade geral" || list[1]["name"] != "Folha" || list[1]["active"] != false {
		t.Fatalf("list: %v", list)
	}

	resp = e.do(http.MethodPut, path, token, map[string]any{"name": "Folha", "active": true})
	if resp.status != http.StatusOK || resp.body["active"] != true {
		t.Fatalf("reactivate: status %d, body %v", resp.status, resp.body)
	}

	actions, changes := e.auditChanges("module", folhaID)
	if len(actions) != 3 || actions[0] != "module_created" || actions[1] != "module_updated" || actions[2] != "module_updated" {
		t.Fatalf("audit actions: %v", actions)
	}
	if changes[1]["name"]["from"] != "Folha de pagamento" || changes[1]["active"]["to"] != false {
		t.Fatalf("update changes: %v", changes[1])
	}
	var actor int64
	if err := e.pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'module' and entity_id = $1 limit 1", folhaID).Scan(&actor); err != nil || actor != sup.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, sup.ID)
	}
}

// doList performs a request whose response is a JSON array.
func (e *testEnv) doList(method, path, token string) []map[string]any {
	e.t.Helper()
	req, err := http.NewRequestWithContext(e.t.Context(), method, e.url+path, nil)
	if err != nil {
		e.t.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		e.t.Fatalf("%s %s: status %d", method, path, resp.StatusCode)
	}
	var out []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		e.t.Fatal(err)
	}
	return out
}
