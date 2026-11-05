package users_test

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestAdministrationRequiresAdmin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	agent := e.User("agente@exemplo.com", db.UserRoleAgent, &contab.ID)

	tokens := map[string]string{
		"supervisor": e.Login("sup@exemplo.com", testPassword),
		"agent":      e.Login("agente@exemplo.com", testPassword),
	}
	sectorBody := map[string]string{"name": "RH"}
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
			if resp := e.Do(req.method, req.path, token, req.body); resp.Status != http.StatusForbidden {
				t.Errorf("%s %s %s: status %d, want 403", who, req.method, req.path, resp.Status)
			}
		}
		if resp := e.Do(req.method, req.path, "", req.body); resp.Status != http.StatusUnauthorized {
			t.Errorf("no session %s %s: status %d, want 401", req.method, req.path, resp.Status)
		}
	}

	var sectors int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from sectors").Scan(&sectors); err != nil {
		t.Fatal(err)
	}
	if sectors != 1 {
		t.Fatalf("sectors = %d, want 1: refused requests must not write", sectors)
	}
}

func TestAdminCreatesUsers(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	resp := e.Do(http.MethodPost, "/api/users", token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "agent", "sectorId": contab.ID, "password": testPassword,
	})
	if resp.Status != http.StatusCreated {
		t.Fatalf("create agent: status %d, body %v", resp.Status, resp.Body)
	}
	if resp.Body["role"] != "agent" || resp.Body["sectorId"] != float64(contab.ID) || resp.Body["active"] != true {
		t.Fatalf("create body: %v", resp.Body)
	}
	if _, ok := resp.Body["passwordHash"]; ok {
		t.Fatal("response must not contain the password hash")
	}
	anaID := id(resp.Body)
	e.Login("ana@exemplo.com", testPassword)

	// The sector sent for an admin is ignored: admins have no sector.
	resp = e.Do(http.MethodPost, "/api/users", token, map[string]any{
		"name": "Bruno", "email": "bruno@exemplo.com", "role": "admin", "sectorId": contab.ID, "password": testPassword,
	})
	if resp.Status != http.StatusCreated || resp.Body["sectorId"] != nil {
		t.Fatalf("create admin: status %d, body %v", resp.Status, resp.Body)
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
		resp := e.Do(http.MethodPost, "/api/users", token, tc.body)
		if resp.Status != tc.want || resp.Body["error"] == "" {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.Status, tc.want, resp.Body)
		}
	}

	list := e.DoList(http.MethodGet, "/api/users", token)
	if len(list) != 3 {
		t.Fatalf("list: %v", list)
	}
	for _, u := range list {
		if _, ok := u["passwordHash"]; ok {
			t.Fatal("list must not contain the password hash")
		}
	}

	actions, changes := e.AuditChanges("user", anaID)
	if len(actions) != 1 || actions[0] != "user_created" || changes[0]["email"]["to"] != "ana@exemplo.com" || changes[0]["role"]["to"] != "agent" {
		t.Fatalf("audit: %v %v", actions, changes)
	}
	if _, ok := changes[0]["password"]; ok {
		t.Fatal("audit must not contain the password")
	}
	var actor int64
	if err := e.Pool.QueryRow(t.Context(), "select actor_id from audit_logs where entity_type = 'user' and entity_id = $1", anaID).Scan(&actor); err != nil || actor != admin.ID {
		t.Fatalf("audit actor = %d (%v), want %d", actor, err, admin.ID)
	}
}

func TestAdminEditsAndDeactivatesUsers(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	ana := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.Login("admin@exemplo.com", testPassword)
	anaToken := e.Login("ana@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/users/%d", ana.ID)

	resp := e.Do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": true,
	})
	if resp.Status != http.StatusOK || resp.Body["role"] != "supervisor" || resp.Body["sectorId"] != float64(rh.ID) {
		t.Fatalf("update: status %d, body %v", resp.Status, resp.Body)
	}
	// The new role and sector apply to the open session right away.
	me := e.Do(http.MethodGet, "/api/auth/me", anaToken, nil)
	if me.Status != http.StatusOK || me.Body["role"] != "supervisor" || me.Body["sectorId"] != float64(rh.ID) {
		t.Fatalf("me after update: status %d, body %v", me.Status, me.Body)
	}

	resp = e.Do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": false,
	})
	if resp.Status != http.StatusOK || resp.Body["active"] != false {
		t.Fatalf("deactivate: status %d, body %v", resp.Status, resp.Body)
	}
	var sessions int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from sessions where user_id = $1", ana.ID).Scan(&sessions); err != nil {
		t.Fatal(err)
	}
	if sessions != 0 {
		t.Fatalf("sessions after deactivation = %d, want 0", sessions)
	}
	if resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword}); resp.Status != http.StatusUnauthorized {
		t.Fatalf("login of deactivated user: status %d", resp.Status)
	}

	resp = e.Do(http.MethodPut, path, token, map[string]any{
		"name": "Ana Souza", "email": "ana@exemplo.com", "role": "supervisor", "sectorId": rh.ID, "active": true,
	})
	if resp.Status != http.StatusOK {
		t.Fatalf("reactivate: status %d", resp.Status)
	}
	e.Login("ana@exemplo.com", testPassword)

	if resp := e.Do(http.MethodPut, "/api/users/999999", token, map[string]any{
		"name": "X", "email": "x@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true,
	}); resp.Status != http.StatusNotFound {
		t.Fatalf("update unknown user: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPut, path, token, map[string]any{
		"name": "Ana", "email": "admin@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true,
	}); resp.Status != http.StatusConflict {
		t.Fatalf("update to existing email: status %d", resp.Status)
	}

	actions, changes := e.AuditChanges("user", ana.ID)
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

func TestAdminCannotLockThemselvesOut(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	other := e.User("admin2@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
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
		if resp := e.Do(http.MethodPut, path, token, tc.body); resp.Status != tc.want {
			t.Errorf("%s: status %d, want %d (body %v)", tc.name, resp.Status, tc.want, resp.Body)
		}
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", token, nil); resp.Status != http.StatusOK || resp.Body["role"] != "admin" {
		t.Fatalf("admin session after refused changes: status %d, body %v", resp.Status, resp.Body)
	}

	// Another administrator can be deactivated.
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d", other.ID), token, map[string]any{
		"name": "Outro", "email": "admin2@exemplo.com", "role": "admin", "active": false,
	})
	if resp.Status != http.StatusOK {
		t.Fatalf("deactivate other admin: status %d, body %v", resp.Status, resp.Body)
	}
}

func TestResetPasswordPermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	rh := e.Sector("RH")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.User("sup.contab@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.User("sup.rh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.User("agente.contab@exemplo.com", db.UserRoleAgent, &contab.ID)
	target := e.User("alvo.contab@exemplo.com", db.UserRoleAgent, &contab.ID)
	otherAdmin := e.User("admin2@exemplo.com", db.UserRoleAdmin, nil)

	cases := []struct {
		name   string
		actor  string
		target int64
		want   int
	}{
		{"admin resets agent", "admin@exemplo.com", target.ID, http.StatusNoContent},
		{"admin resets admin", "admin@exemplo.com", otherAdmin.ID, http.StatusNoContent},
		{"supervisor resets agent of own sector", "sup.contab@exemplo.com", target.ID, http.StatusNoContent},
		{"supervisor of other sector", "sup.rh@exemplo.com", target.ID, http.StatusForbidden},
		{"supervisor resets admin", "sup.contab@exemplo.com", otherAdmin.ID, http.StatusForbidden},
		{"agent", "agente.contab@exemplo.com", target.ID, http.StatusForbidden},
		{"unknown user", "admin@exemplo.com", 999999, http.StatusNotFound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			token := e.Login(tc.actor, testPassword)
			path := fmt.Sprintf("/api/users/%d/password", tc.target)
			resp := e.Do(http.MethodPut, path, token, map[string]string{"password": testPassword})
			if resp.Status != tc.want {
				t.Fatalf("status %d, want %d (body %v)", resp.Status, tc.want, resp.Body)
			}
		})
	}

	path := fmt.Sprintf("/api/users/%d/password", target.ID)
	if resp := e.Do(http.MethodPut, path, "", map[string]string{"password": testPassword}); resp.Status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.Status)
	}
}

func TestResetPasswordEndsSessionsAndAudits(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &sector.ID)
	target := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	targetToken := e.Login("ana@exemplo.com", testPassword)
	supToken := e.Login("sup@exemplo.com", testPassword)

	const newPassword = "Nova#Senha9"
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d/password", target.ID), supToken, map[string]string{"password": newPassword})
	if resp.Status != http.StatusNoContent {
		t.Fatalf("reset: status %d, body %v", resp.Status, resp.Body)
	}

	if resp := e.Do(http.MethodGet, "/api/auth/me", targetToken, nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("old session after reset: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword}); resp.Status != http.StatusUnauthorized {
		t.Fatalf("old password after reset: status %d", resp.Status)
	}
	e.Login("ana@exemplo.com", newPassword)

	logs, err := e.Q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "user", EntityID: target.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(logs) != 1 || logs[0].Action != "user_password_reset" || logs[0].ActorID == nil || *logs[0].ActorID != sup.ID {
		t.Fatalf("audit logs: %+v", logs)
	}
	if logs[0].Changes != nil && strings.Contains(string(logs[0].Changes), newPassword) {
		t.Fatal("audit must not contain the password")
	}
}

func TestResetPasswordPolicy(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	target := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("admin@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/users/%d/password", target.ID)

	cases := []struct {
		password string
		want     int
	}{
		{"Ab1!xyz", http.StatusUnprocessableEntity},                        // 7 characters
		{"abcdef1!", http.StatusUnprocessableEntity},                       // no uppercase
		{"ABCDEF1!", http.StatusUnprocessableEntity},                       // no lowercase
		{"Abcdefg!", http.StatusUnprocessableEntity},                       // no digit
		{"Abcdefg1", http.StatusUnprocessableEntity},                       // no special character
		{"Aa1!" + strings.Repeat("x", 69), http.StatusUnprocessableEntity}, // 73 bytes, over the bcrypt limit
		{"", http.StatusUnprocessableEntity},
		{"Cofre#47", http.StatusNoContent},
		{"Ação 2026 válida", http.StatusNoContent}, // accented letters and space as special character
	}
	for _, tc := range cases {
		resp := e.Do(http.MethodPut, path, token, map[string]string{"password": tc.password})
		if resp.Status != tc.want {
			t.Fatalf("password %q: status %d, want %d", tc.password, resp.Status, tc.want)
		}
		if tc.want == http.StatusUnprocessableEntity && resp.Body["error"] == "" {
			t.Fatalf("password %q: missing error message", tc.password)
		}
	}
}

func TestCommonPasswordsAreRefused(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	target := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("admin@exemplo.com", testPassword)
	const message = "Senha muito comum. Escolha outra, mais difícil de adivinhar."

	for _, password := range []string{
		"Senha@123", "sENHA123!", "S3nh@2026!", "@Senha123", "P@ssw0rd1!", "Password1!", "Admin@2026", "@Dmin123", "Mudar#123",
		"Qwerty123!", "Abc@1234", "Aa@123456", "Q1w2e3r4!", "1Q2w3e4r!", "1qaz2Wsx!", "Contabilidade@1",
	} {
		resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d/password", target.ID), token, map[string]string{"password": password})
		if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != message {
			t.Fatalf("reset with %q: status %d, body %v", password, resp.Status, resp.Body)
		}
	}

	resp := e.Do(http.MethodPost, "/api/users", token, map[string]any{
		"name": "Bia", "email": "bia@exemplo.com", "role": "agent", "sectorId": sector.ID, "password": "Senha@123",
	})
	if resp.Status != http.StatusUnprocessableEntity || resp.Body["error"] != message {
		t.Fatalf("create with common password: status %d, body %v", resp.Status, resp.Body)
	}

	// A common word inside a longer password is not a common password.
	for _, password := range []string{"Minha-Senha-Azul7", "Cofre#Azul47"} {
		resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d/password", target.ID), token, map[string]string{"password": password})
		if resp.Status != http.StatusNoContent {
			t.Fatalf("reset with %q: status %d, body %v", password, resp.Status, resp.Body)
		}
	}
}

func TestResetPasswordEndsLoginLock(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	target := e.User("Ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("admin@exemplo.com", testPassword)

	login := func(password string) int {
		return e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": password}).Status
	}
	for range auth.MaxEmailFailures {
		if status := login("Errada#Azul47"); status != http.StatusUnauthorized {
			t.Fatalf("wrong password: status %d", status)
		}
	}
	if status := login(testPassword); status != http.StatusTooManyRequests {
		t.Fatalf("locked login: status %d", status)
	}

	const newPassword = "Nova#Azul58"
	resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d/password", target.ID), token, map[string]string{"password": newPassword})
	if resp.Status != http.StatusNoContent {
		t.Fatalf("reset: status %d, body %v", resp.Status, resp.Body)
	}
	if status := login(newPassword); status != http.StatusOK {
		t.Fatalf("login after the reset: status %d", status)
	}
}

func TestNicknameDefaultsToFirstAndLastName(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	cases := []struct{ name, nickname, want string }{
		{"Ana Maria de Souza", "", "Ana Souza"},
		{"Bruno", "", "Bruno"},
		{"Carla  Dias", "   ", "Carla Dias"},
		{"Daniel Lima", "  Dani  ", "Dani"},
	}
	for i, tc := range cases {
		resp := e.Do(http.MethodPost, "/api/users", token, map[string]any{
			"name": tc.name, "nickname": tc.nickname, "email": fmt.Sprintf("u%d@exemplo.com", i),
			"role": "agent", "sectorId": contab.ID, "password": testPassword,
		})
		if resp.Status != http.StatusCreated || resp.Body["nickname"] != tc.want {
			t.Fatalf("%q: status %d, body %v, want %q", tc.name, resp.Status, resp.Body, tc.want)
		}
		_, changes := e.AuditChanges("user", id(resp.Body))
		if changes[0]["nickname"]["to"] != tc.want {
			t.Fatalf("%q: audit %v", tc.name, changes)
		}
	}

	// A lista da administração devolve o campo.
	found := false
	for _, u := range e.DoList(http.MethodGet, "/api/users", token) {
		found = found || u["nickname"] == "Dani"
	}
	if !found {
		t.Fatal("list without the nickname")
	}
}

func TestNicknameIsUnique(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)
	create := func(name, nickname, email string) (int, map[string]any) {
		t.Helper()
		resp := e.Do(http.MethodPost, "/api/users", token, map[string]any{
			"name": name, "nickname": nickname, "email": email, "role": "agent", "sectorId": contab.ID, "password": testPassword,
		})
		return resp.Status, resp.Body
	}
	const taken = "Já existe um usuário com este apelido."

	status, ana := create("Ana Souza", "", "ana@exemplo.com")
	if status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", status, ana)
	}
	status, other := create("Bia Lima", "Bia", "bia@exemplo.com")
	if status != http.StatusCreated {
		t.Fatalf("create: status %d, body %v", status, other)
	}
	put := func(body map[string]any, target map[string]any) (int, map[string]any) {
		t.Helper()
		resp := e.Do(http.MethodPut, fmt.Sprintf("/api/users/%d", id(target)), token, body)
		return resp.Status, resp.Body
	}

	// No cadastro, com outra combinação de maiúsculas e pelo apelido gerado do nome.
	for _, nickname := range []string{"ANA SOUZA", ""} {
		if status, body := create("Ana Maria Souza", nickname, "outra@exemplo.com"); status != http.StatusConflict || body["error"] != taken {
			t.Fatalf("create %q: status %d, body %v", nickname, status, body)
		}
	}
	// Na edição.
	edit := map[string]any{"name": "Bia Lima", "nickname": "ana souza", "email": "bia@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true}
	if status, body := put(edit, other); status != http.StatusConflict || body["error"] != taken {
		t.Fatalf("update: status %d, body %v", status, body)
	}

	// Usuário inativo continua segurando o apelido.
	deactivate := map[string]any{"name": "Ana Souza", "nickname": "Ana Souza", "email": "ana@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": false}
	if status, body := put(deactivate, ana); status != http.StatusOK {
		t.Fatalf("deactivate: status %d, body %v", status, body)
	}
	if status, body := create("Ana Souza", "", "outra@exemplo.com"); status != http.StatusConflict || body["error"] != taken {
		t.Fatalf("create against inactive: status %d, body %v", status, body)
	}
	if status, body := put(edit, other); status != http.StatusConflict || body["error"] != taken {
		t.Fatalf("update against inactive: status %d, body %v", status, body)
	}
}

// Criações simultâneas com o mesmo apelido: o banco deixa passar só uma, e as
// demais recebem a mesma recusa, não um erro 500.
func TestConcurrentCreationsWithTheSameNickname(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	token := e.Login("admin@exemplo.com", testPassword)

	const attempts = 6
	statuses := make([]int, attempts)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			<-start
			statuses[i] = e.Do(http.MethodPost, "/api/users", token, map[string]any{
				"name": "Ana Souza", "nickname": "Ana", "email": fmt.Sprintf("ana%d@exemplo.com", i),
				"role": "agent", "sectorId": contab.ID, "password": testPassword,
			}).Status
		})
	}
	close(start)
	wg.Wait()

	created := 0
	for _, status := range statuses {
		switch status {
		case http.StatusCreated:
			created++
		case http.StatusConflict:
		default:
			t.Fatalf("statuses = %v", statuses)
		}
	}
	if created != 1 {
		t.Fatalf("statuses = %v, want exactly one created", statuses)
	}
}

func TestEditingKeepsOrChangesTheNickname(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.Sector("Contabilidade")
	e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	sup := e.User("sup@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	agent := e.User("ana@exemplo.com", db.UserRoleAgent, &contab.ID)
	token := e.Login("admin@exemplo.com", testPassword)
	path := fmt.Sprintf("/api/users/%d", agent.ID)
	body := func(name, nickname string) map[string]any {
		return map[string]any{"name": name, "nickname": nickname, "email": "ana@exemplo.com", "role": "agent", "sectorId": contab.ID, "active": true}
	}

	resp := e.Do(http.MethodPut, path, token, body("Ana Souza", "Aninha"))
	if resp.Status != http.StatusOK || resp.Body["nickname"] != "Aninha" {
		t.Fatalf("set nickname: status %d, body %v", resp.Status, resp.Body)
	}
	// Mudar o nome não muda o apelido.
	resp = e.Do(http.MethodPut, path, token, body("Ana Maria Souza", "Aninha"))
	if resp.Status != http.StatusOK || resp.Body["name"] != "Ana Maria Souza" || resp.Body["nickname"] != "Aninha" {
		t.Fatalf("rename: status %d, body %v", resp.Status, resp.Body)
	}
	// Vazio volta a ser o primeiro e o último nome.
	resp = e.Do(http.MethodPut, path, token, body("Ana Maria Souza", ""))
	if resp.Status != http.StatusOK || resp.Body["nickname"] != "Ana Souza" {
		t.Fatalf("clear: status %d, body %v", resp.Status, resp.Body)
	}

	_, changes := e.AuditChanges("user", agent.ID)
	last := changes[len(changes)-1]["nickname"]
	if last["from"] != "Aninha" || last["to"] != "Ana Souza" {
		t.Fatalf("audit: %v", changes)
	}
	if _, ok := changes[1]["nickname"]; ok {
		t.Fatalf("rename recorded a nickname change: %v", changes[1])
	}

	// Só o administrador altera.
	for _, who := range []string{sup.Email, agent.Email} {
		other := e.Login(who, testPassword)
		if r := e.Do(http.MethodPut, path, other, body("Ana Maria Souza", "Outro")); r.Status != http.StatusForbidden {
			t.Fatalf("%s: status %d", who, r.Status)
		}
	}
}
