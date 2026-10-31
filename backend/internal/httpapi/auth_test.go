package httpapi

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/sector"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

const testPassword = "Senha@123"

type testEnv struct {
	t    *testing.T
	pool *pgxpool.Pool
	q    *db.Queries
	url  string
}

// newTestEnv starts the API on a fresh database. extra registers routes used
// only by the test, behind the same session middleware as the real ones.
func newTestEnv(t *testing.T, extra func(s *server, r chi.Router)) *testEnv {
	t.Helper()
	pool := testdb.New(t)
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	handler := NewRouter(logger, auth.NewService(pool), sector.NewService(pool), Options{SecureCookie: true})
	if extra != nil {
		s := &server{logger: logger, auth: auth.NewService(pool), opts: Options{SecureCookie: true}}
		r := chi.NewRouter()
		r.Mount("/", handler)
		r.Route("/test", func(r chi.Router) { extra(s, r) })
		handler = r
	}
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return &testEnv{t: t, pool: pool, q: db.New(pool), url: srv.URL}
}

func (e *testEnv) sector(name, phone string) db.Sector {
	e.t.Helper()
	s, err := e.q.CreateSector(e.t.Context(), db.CreateSectorParams{Name: name, Phone: phone, Provider: "whatsmeow"})
	if err != nil {
		e.t.Fatal(err)
	}
	return s
}

func (e *testEnv) user(email string, role db.UserRole, sectorID *int64) db.User {
	e.t.Helper()
	hash, err := auth.HashPassword(testPassword)
	if err != nil {
		e.t.Fatal(err)
	}
	u, err := e.q.CreateUser(e.t.Context(), db.CreateUserParams{
		Name: email, Email: email, PasswordHash: hash, Role: role, SectorID: sectorID,
	})
	if err != nil {
		e.t.Fatal(err)
	}
	return u
}

type response struct {
	status  int
	body    map[string]any
	cookies []*http.Cookie
}

func (e *testEnv) do(method, path, token string, body any) response {
	e.t.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			e.t.Fatal(err)
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(e.t.Context(), method, e.url+path, reader)
	if err != nil {
		e.t.Fatal(err)
	}
	if token != "" {
		req.AddCookie(&http.Cookie{Name: sessionCookie, Value: token})
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	defer resp.Body.Close()
	out := response{status: resp.StatusCode, cookies: resp.Cookies()}
	raw, _ := io.ReadAll(resp.Body)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out.body)
	}
	return out
}

// login returns the session token of a successful login.
func (e *testEnv) login(email, password string) string {
	e.t.Helper()
	resp := e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": email, "password": password})
	if resp.status != http.StatusOK {
		e.t.Fatalf("login %s: status %d, body %v", email, resp.status, resp.body)
	}
	for _, c := range resp.cookies {
		if c.Name == sessionCookie {
			return c.Value
		}
	}
	e.t.Fatalf("login %s: no session cookie", email)
	return ""
}

func TestLoginAndLogout(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	agent := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	resp := e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": "Errada@123"})
	if resp.status != http.StatusUnauthorized {
		t.Fatalf("wrong password: status %d", resp.status)
	}
	resp = e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "nao@existe.com", "password": testPassword})
	if resp.status != http.StatusUnauthorized {
		t.Fatalf("unknown email: status %d", resp.status)
	}

	resp = e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ANA@exemplo.com", "password": testPassword})
	if resp.status != http.StatusOK {
		t.Fatalf("login: status %d, body %v", resp.status, resp.body)
	}
	var cookie *http.Cookie
	for _, c := range resp.cookies {
		if c.Name == sessionCookie {
			cookie = c
		}
	}
	if cookie == nil || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie must be HttpOnly, Secure and SameSite=Lax: %+v", cookie)
	}
	if resp.body["role"] != "agent" || resp.body["sectorId"] != float64(sector.ID) {
		t.Fatalf("login body: %v", resp.body)
	}

	// The token itself is never stored, only its hash.
	var stored int
	if err := e.pool.QueryRow(t.Context(), "select count(*) from sessions where user_id = $1 and token_hash <> $2", agent.ID, cookie.Value).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != 1 {
		t.Fatalf("sessions with hashed token = %d, want 1", stored)
	}

	me := e.do(http.MethodGet, "/api/auth/me", cookie.Value, nil)
	if me.status != http.StatusOK || me.body["email"] != "ana@exemplo.com" {
		t.Fatalf("me: status %d, body %v", me.status, me.body)
	}

	if resp := e.do(http.MethodPost, "/api/auth/logout", cookie.Value, nil); resp.status != http.StatusNoContent {
		t.Fatalf("logout: status %d", resp.status)
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", cookie.Value, nil); resp.status != http.StatusUnauthorized {
		t.Fatalf("me after logout: status %d", resp.status)
	}
}

func TestLoginCreatesNewTokenEachTime(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	first := e.login("ana@exemplo.com", testPassword)
	second := e.login("ana@exemplo.com", testPassword)
	if first == second {
		t.Fatal("each login must create a new token")
	}
	for _, token := range []string{first, second} {
		if resp := e.do(http.MethodGet, "/api/auth/me", token, nil); resp.status != http.StatusOK {
			t.Fatalf("me: status %d", resp.status)
		}
	}
}

func TestInactiveUserCannotLogin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	agent := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.login("ana@exemplo.com", testPassword)

	if _, err := e.pool.Exec(t.Context(), "update users set active = false where id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}

	resp := e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword})
	if resp.status != http.StatusUnauthorized {
		t.Fatalf("login of inactive user: status %d", resp.status)
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", token, nil); resp.status != http.StatusUnauthorized {
		t.Fatalf("session of inactive user: status %d", resp.status)
	}
}

func TestProtectedRouteRequiresValidSession(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	agent := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.login("ana@exemplo.com", testPassword)

	for name, tok := range map[string]string{"no cookie": "", "unknown token": "token-inventado"} {
		if resp := e.do(http.MethodGet, "/api/auth/me", tok, nil); resp.status != http.StatusUnauthorized {
			t.Fatalf("%s: status %d", name, resp.status)
		}
	}

	if _, err := e.pool.Exec(t.Context(), "update sessions set expires_at = now() - interval '1 second' where user_id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", token, nil); resp.status != http.StatusUnauthorized {
		t.Fatalf("expired session: status %d", resp.status)
	}
}

func TestSessionExpirationSlides(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	agent := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.login("ana@exemplo.com", testPassword)

	if _, err := e.pool.Exec(t.Context(), "update sessions set expires_at = now() + interval '1 minute' where user_id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.do(http.MethodGet, "/api/auth/me", token, nil); resp.status != http.StatusOK {
		t.Fatalf("me: status %d", resp.status)
	}

	var expiresAt time.Time
	if err := e.pool.QueryRow(t.Context(), "select expires_at from sessions where user_id = $1", agent.ID).Scan(&expiresAt); err != nil {
		t.Fatal(err)
	}
	if until := time.Until(expiresAt); until < auth.SessionTTL-time.Minute || until > auth.SessionTTL {
		t.Fatalf("expires in %s, want about %s", until, auth.SessionTTL)
	}
}

func TestResetPasswordPermissions(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	contab := e.sector("Contabilidade", "5511999990000")
	rh := e.sector("RH", "5511999990001")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.user("sup.contab@exemplo.com", db.UserRoleSupervisor, &contab.ID)
	e.user("sup.rh@exemplo.com", db.UserRoleSupervisor, &rh.ID)
	e.user("agente.contab@exemplo.com", db.UserRoleAgent, &contab.ID)
	target := e.user("alvo.contab@exemplo.com", db.UserRoleAgent, &contab.ID)
	otherAdmin := e.user("admin2@exemplo.com", db.UserRoleAdmin, nil)

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
			token := e.login(tc.actor, testPassword)
			path := fmt.Sprintf("/api/users/%d/password", tc.target)
			resp := e.do(http.MethodPut, path, token, map[string]string{"password": testPassword})
			if resp.status != tc.want {
				t.Fatalf("status %d, want %d (body %v)", resp.status, tc.want, resp.body)
			}
		})
	}

	path := fmt.Sprintf("/api/users/%d/password", target.ID)
	if resp := e.do(http.MethodPut, path, "", map[string]string{"password": testPassword}); resp.status != http.StatusUnauthorized {
		t.Fatalf("without session: status %d", resp.status)
	}
}

func TestResetPasswordEndsSessionsAndAudits(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.sector("Contabilidade", "5511999990000")
	sup := e.user("sup@exemplo.com", db.UserRoleSupervisor, &sector.ID)
	target := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	targetToken := e.login("ana@exemplo.com", testPassword)
	supToken := e.login("sup@exemplo.com", testPassword)

	const newPassword = "Nova#Senha9"
	resp := e.do(http.MethodPut, fmt.Sprintf("/api/users/%d/password", target.ID), supToken, map[string]string{"password": newPassword})
	if resp.status != http.StatusNoContent {
		t.Fatalf("reset: status %d, body %v", resp.status, resp.body)
	}

	if resp := e.do(http.MethodGet, "/api/auth/me", targetToken, nil); resp.status != http.StatusUnauthorized {
		t.Fatalf("old session after reset: status %d", resp.status)
	}
	if resp := e.do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword}); resp.status != http.StatusUnauthorized {
		t.Fatalf("old password after reset: status %d", resp.status)
	}
	e.login("ana@exemplo.com", newPassword)

	logs, err := e.q.ListAuditLogsByEntity(t.Context(), db.ListAuditLogsByEntityParams{EntityType: "user", EntityID: target.ID})
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
	sector := e.sector("Contabilidade", "5511999990000")
	e.user("admin@exemplo.com", db.UserRoleAdmin, nil)
	target := e.user("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.login("admin@exemplo.com", testPassword)
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
		{"Abcdef1!", http.StatusNoContent},
		{"Ação 2026 válida", http.StatusNoContent}, // accented letters and space as special character
	}
	for _, tc := range cases {
		resp := e.do(http.MethodPut, path, token, map[string]string{"password": tc.password})
		if resp.status != tc.want {
			t.Fatalf("password %q: status %d, want %d", tc.password, resp.status, tc.want)
		}
		if tc.want == http.StatusUnprocessableEntity && resp.body["error"] == "" {
			t.Fatalf("password %q: missing error message", tc.password)
		}
	}
}

func TestRequireRoleAndSector(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, func(s *server, r chi.Router) {
		ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }
		r.Use(s.requireUser)
		r.With(requireSector("sectorID")).Get("/sectors/{sectorID}", ok)
		r.With(requireRole(db.UserRoleSupervisor, db.UserRoleAdmin)).Get("/supervision", ok)
	})
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
		who  string
		path string
		want int
	}{
		{"agent", fmt.Sprintf("/test/sectors/%d", contab.ID), http.StatusOK},
		{"agent", fmt.Sprintf("/test/sectors/%d", rh.ID), http.StatusForbidden},
		{"supervisor", fmt.Sprintf("/test/sectors/%d", contab.ID), http.StatusOK},
		{"supervisor", fmt.Sprintf("/test/sectors/%d", rh.ID), http.StatusForbidden},
		{"admin", fmt.Sprintf("/test/sectors/%d", contab.ID), http.StatusOK},
		{"admin", fmt.Sprintf("/test/sectors/%d", rh.ID), http.StatusOK},
		{"agent", "/test/sectors/abc", http.StatusForbidden},
		{"none", fmt.Sprintf("/test/sectors/%d", contab.ID), http.StatusUnauthorized},
		{"agent", "/test/supervision", http.StatusForbidden},
		{"supervisor", "/test/supervision", http.StatusOK},
		{"admin", "/test/supervision", http.StatusOK},
		{"none", "/test/supervision", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		if resp := e.do(http.MethodGet, tc.path, tokens[tc.who], nil); resp.status != tc.want {
			t.Errorf("%s GET %s: status %d, want %d", tc.who, tc.path, resp.status, tc.want)
		}
	}
}
