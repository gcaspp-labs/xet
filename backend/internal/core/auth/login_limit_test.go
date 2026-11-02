package auth_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
)

const wrongPassword = "Errada#Azul47"

func (e *testEnv) loginStatus(email, password string) int {
	e.T.Helper()
	return e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": email, "password": password}).Status
}

func (e *testEnv) failLogins(email string, times int) {
	e.T.Helper()
	for i := range times {
		if status := e.loginStatus(email, wrongPassword); status != http.StatusUnauthorized {
			e.T.Fatalf("%s, wrong attempt %d: status %d, want 401", email, i+1, status)
		}
	}
}

// seedFailures saves the failed attempts of an IP, without the cost of bcrypt.
func (e *testEnv) seedFailures(ip string, failures int) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(),
		"insert into login_attempts (scope, subject, failures, last_failure_at) values ('ip', $1, $2, now())", ip, failures); err != nil {
		e.T.Fatal(err)
	}
}

// ageAttempts moves the attempts back in time, as if the minutes had passed.
func (e *testEnv) ageAttempts(minutes int) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(), `update login_attempts
		set last_failure_at = last_failure_at - make_interval(mins => $1),
			locked_until = locked_until - make_interval(mins => $1)`, minutes); err != nil {
		e.T.Fatal(err)
	}
}

func TestLoginLocksAfterEmailFailures(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.User("bia@exemplo.com", db.UserRoleAgent, &sector.ID)

	e.failLogins("ana@exemplo.com", auth.MaxEmailFailures)

	// Locked even with the right password, and whatever the case of the e-mail.
	resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": "ANA@exemplo.com", "password": testPassword})
	if resp.Status != http.StatusTooManyRequests || resp.Body["error"] == "" {
		t.Fatalf("locked login: status %d, body %v", resp.Status, resp.Body)
	}
	if status := e.loginStatus("bia@exemplo.com", testPassword); status != http.StatusOK {
		t.Fatalf("other user: status %d", status)
	}

	// Attempts during the lock do not extend it.
	e.ageAttempts(14)
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusTooManyRequests {
		t.Fatalf("before the end of the lock: status %d", status)
	}
	e.ageAttempts(2)
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusOK {
		t.Fatalf("after the lock: status %d", status)
	}
}

func TestLoginLockDoesNotRevealUnknownEmail(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)

	e.failLogins("nao@existe.com", auth.MaxEmailFailures)
	if status := e.loginStatus("nao@existe.com", wrongPassword); status != http.StatusTooManyRequests {
		t.Fatalf("unknown e-mail: status %d", status)
	}
}

func TestLoginFailuresStartOverOnSuccessAndWithTime(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	e.failLogins("ana@exemplo.com", auth.MaxEmailFailures-1)
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusOK {
		t.Fatalf("right password: status %d", status)
	}

	e.failLogins("ana@exemplo.com", auth.MaxEmailFailures-1)
	e.ageAttempts(16)
	e.failLogins("ana@exemplo.com", auth.MaxEmailFailures-1)
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusOK {
		t.Fatalf("after old failures: status %d", status)
	}
}

func TestLoginLimitHoldsUnderConcurrency(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)

	const attempts = 20
	statuses := make([]int, attempts)
	var wg sync.WaitGroup
	for i := range attempts {
		wg.Go(func() {
			statuses[i] = e.loginStatus("ana@exemplo.com", wrongPassword)
		})
	}
	wg.Wait()

	counts := map[int]int{}
	for _, status := range statuses {
		counts[status]++
	}
	if counts[http.StatusUnauthorized] != auth.MaxEmailFailures || counts[http.StatusTooManyRequests] != attempts-auth.MaxEmailFailures {
		t.Fatalf("statuses: %v, want %d checked passwords and the rest locked", counts, auth.MaxEmailFailures)
	}
}

func TestLoginLocksAfterIPFailures(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.seedFailures("127.0.0.1", auth.MaxIPFailures-2)

	// A right login takes back only its own attempt, so an account of the
	// attacker does not start the count over.
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusOK {
		t.Fatalf("right password: status %d", status)
	}
	e.failLogins("outro@exemplo.com", 1)
	e.failLogins("mais-um@exemplo.com", 1)
	if status := e.loginStatus("ana@exemplo.com", testPassword); status != http.StatusTooManyRequests {
		t.Fatalf("locked IP: status %d", status)
	}

	// The lock of the IP does not count against the e-mail.
	var rows int
	if err := e.Pool.QueryRow(t.Context(), "select count(*) from login_attempts where subject = 'ana@exemplo.com'").Scan(&rows); err != nil {
		t.Fatal(err)
	}
	if rows != 0 {
		t.Fatalf("e-mail attempts counted during the IP lock: %d", rows)
	}
}

func TestLoginIPBehindProxy(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	e.seedFailures("203.0.113.1", auth.MaxIPFailures)
	if _, err := e.Pool.Exec(t.Context(), "update login_attempts set locked_until = now() + interval '15 minutes'"); err != nil {
		t.Fatal(err)
	}

	r := chi.NewRouter()
	auth.NewHandler(slog.New(slog.NewTextHandler(io.Discard, nil)), auth.NewService(e.Pool), true, true).Routes(r)
	proxied := httptest.NewServer(r)
	t.Cleanup(proxied.Close)

	cases := []struct {
		name      string
		url       string
		forwarded string
		want      int
	}{
		{"trusted proxy, locked IP", proxied.URL, "203.0.113.1", http.StatusTooManyRequests},
		{"trusted proxy, the client cannot forge the last value", proxied.URL, "198.51.100.9, 203.0.113.1", http.StatusTooManyRequests},
		{"trusted proxy, other IP", proxied.URL, "198.51.100.9", http.StatusOK},
		{"no proxy, the header is ignored", e.URL + "/api", "203.0.113.1", http.StatusOK},
	}
	for _, tc := range cases {
		body, err := json.Marshal(map[string]string{"email": "ana@exemplo.com", "password": testPassword})
		if err != nil {
			t.Fatal(err)
		}
		req, err := http.NewRequestWithContext(t.Context(), http.MethodPost, tc.url+"/auth/login", bytes.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", tc.forwarded)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != tc.want {
			t.Fatalf("%s: status %d, want %d", tc.name, resp.StatusCode, tc.want)
		}
	}
}

func TestCleanupRemovesExpiredLoginData(t *testing.T) {
	t.Parallel()
	e := newTestEnv(t, nil)
	sector := e.Sector("Contabilidade")
	gone := e.User("ana@exemplo.com", db.UserRoleAgent, &sector.ID)
	active := e.User("bia@exemplo.com", db.UserRoleAgent, &sector.ID)
	ctx := t.Context()

	// Neither user logs in again: nothing but the routine removes the session.
	if err := e.Q.CreateSession(ctx, db.CreateSessionParams{TokenHash: "expired", UserID: gone.ID, ExpiresAt: time.Now().Add(-time.Minute)}); err != nil {
		t.Fatal(err)
	}
	if err := e.Q.CreateSession(ctx, db.CreateSessionParams{TokenHash: "valid", UserID: active.ID, ExpiresAt: time.Now().Add(time.Hour)}); err != nil {
		t.Fatal(err)
	}
	if _, err := e.Pool.Exec(ctx, `insert into login_attempts (scope, subject, failures, last_failure_at, locked_until) values
		('email', 'velha@exemplo.com', 2, now() - interval '16 minutes', null),
		('email', 'recente@exemplo.com', 2, now() - interval '1 minute', null),
		('email', 'bloqueada@exemplo.com', 5, now() - interval '16 minutes', now() + interval '1 minute')`); err != nil {
		t.Fatal(err)
	}

	cleanupCtx, stop := context.WithCancel(ctx)
	var wg sync.WaitGroup
	wg.Go(func() {
		auth.NewService(e.Pool).RunCleanup(cleanupCtx, 20*time.Millisecond, slog.New(slog.NewTextHandler(io.Discard, nil)))
	})
	t.Cleanup(func() {
		stop()
		wg.Wait()
	})

	deadline := time.Now().Add(5 * time.Second)
	for e.Count("sessions") != 1 || e.Count("login_attempts") != 2 {
		if time.Now().After(deadline) {
			t.Fatalf("sessions = %d, attempts = %d", e.Count("sessions"), e.Count("login_attempts"))
		}
		time.Sleep(10 * time.Millisecond)
	}

	var token string
	if err := e.Pool.QueryRow(ctx, "select token_hash from sessions").Scan(&token); err != nil {
		t.Fatal(err)
	}
	if token != "valid" {
		t.Fatalf("remaining session: %s", token)
	}
	var subjects int
	if err := e.Pool.QueryRow(ctx, "select count(*) from login_attempts where subject in ('recente@exemplo.com', 'bloqueada@exemplo.com')").Scan(&subjects); err != nil {
		t.Fatal(err)
	}
	if subjects != 2 {
		t.Fatalf("recent and locked attempts must stay, got %d", subjects)
	}
}
