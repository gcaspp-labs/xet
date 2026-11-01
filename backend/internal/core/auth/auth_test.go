package auth_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

func TestLoginAndLogout(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	agent := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": "Errada@123"})
	if resp.Status != http.StatusUnauthorized {
		t.Fatalf("wrong password: status %d", resp.Status)
	}
	resp = e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "nao@existe.com", "password": testPassword})
	if resp.Status != http.StatusUnauthorized {
		t.Fatalf("unknown email: status %d", resp.Status)
	}

	resp = e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ANA@exemplo.com", "password": testPassword})
	if resp.Status != http.StatusOK {
		t.Fatalf("login: status %d, body %v", resp.Status, resp.Body)
	}
	var cookie *http.Cookie
	for _, c := range resp.Cookies {
		if c.Name == auth.SessionCookie {
			cookie = c
		}
	}
	if cookie == nil || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode {
		t.Fatalf("session cookie must be HttpOnly, Secure and SameSite=Lax: %+v", cookie)
	}
	if resp.Body["role"] != "agent" || resp.Body["sectorId"] != float64(sector.ID) {
		t.Fatalf("login body: %v", resp.Body)
	}

	// The token itself is never stored, only its hash.
	var stored int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from sessions where user_id = $1 and token_hash <> $2", agent.ID, cookie.Value).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored != 1 {
		t.Fatalf("sessions with hashed token = %d, want 1", stored)
	}

	me := e.Do(http.MethodGet, "/api/auth/me", cookie.Value, nil)
	if me.Status != http.StatusOK || me.Body["email"] != "ana@exemplo.com" {
		t.Fatalf("me: status %d, body %v", me.Status, me.Body)
	}

	if resp := e.Do(http.MethodPost, "/api/auth/logout", cookie.Value, nil); resp.Status != http.StatusNoContent {
		t.Fatalf("logout: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", cookie.Value, nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("me after logout: status %d", resp.Status)
	}
}

func TestLoginCreatesNewTokenEachTime(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	first := e.Login("ana@exemplo.com", testPassword)
	second := e.Login("ana@exemplo.com", testPassword)
	if first == second {
		t.Fatal("each login must create a new token")
	}
	for _, token := range []string{first, second} {
		if resp := e.Do(http.MethodGet, "/api/auth/me", token, nil); resp.Status != http.StatusOK {
			t.Fatalf("me: status %d", resp.Status)
		}
	}
}

func TestInactiveUserCannotLogin(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	agent := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("ana@exemplo.com", testPassword)

	if _, err := e.Pool.Exec(t.Context(), "update users set active = false where id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}

	resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ana@exemplo.com", "password": testPassword})
	if resp.Status != http.StatusUnauthorized {
		t.Fatalf("login of inactive user: status %d", resp.Status)
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", token, nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("session of inactive user: status %d", resp.Status)
	}
}

func TestProtectedRouteRequiresValidSession(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	agent := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("ana@exemplo.com", testPassword)

	for name, tok := range map[string]string{"no cookie": "", "unknown token": "token-inventado"} {
		if resp := e.Do(http.MethodGet, "/api/auth/me", tok, nil); resp.Status != http.StatusUnauthorized {
			t.Fatalf("%s: status %d", name, resp.Status)
		}
	}

	if _, err := e.Pool.Exec(t.Context(), "update sessions set expires_at = now() - interval '1 second' where user_id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", token, nil); resp.Status != http.StatusUnauthorized {
		t.Fatalf("expired session: status %d", resp.Status)
	}
}

func TestSessionExpirationSlides(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	agent := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	token := e.Login("ana@exemplo.com", testPassword)

	if _, err := e.Pool.Exec(t.Context(), "update sessions set expires_at = now() + interval '1 minute' where user_id = $1", agent.ID); err != nil {
		t.Fatal(err)
	}
	if resp := e.Do(http.MethodGet, "/api/auth/me", token, nil); resp.Status != http.StatusOK {
		t.Fatalf("me: status %d", resp.Status)
	}

	var expiresAt time.Time
	if err := e.Pool.QueryRow(t.Context(), "select expires_at from sessions where user_id = $1", agent.ID).Scan(&expiresAt); err != nil {
		t.Fatal(err)
	}
	if until := time.Until(expiresAt); until < auth.SessionTTL-time.Minute || until > auth.SessionTTL {
		t.Fatalf("expires in %s, want about %s", until, auth.SessionTTL)
	}
}

func TestRequireRoleAndSector(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, func(a *auth.Handler, r chi.Router) {
		ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }
		r.Use(a.RequireUser)
		r.With(auth.RequireSector("sectorID")).Get("/sectors/{sectorID}", ok)
		r.With(auth.RequireRole(db.UserRoleSupervisor, db.UserRoleAdmin)).Get("/supervision", ok)
	})
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
		if resp := e.Do(http.MethodGet, tc.path, tokens[tc.who], nil); resp.Status != tc.want {
			t.Errorf("%s GET %s: status %d, want %d", tc.who, tc.path, resp.Status, tc.want)
		}
	}
}
