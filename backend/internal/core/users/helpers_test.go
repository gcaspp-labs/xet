package users_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/testapi"
)

const testPassword = testapi.Password

var id = testapi.ID

type testEnv struct{ *testapi.Env }

func newTestEnv(t *testing.T, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.New(t, extra)}
}

const ownPasswordPath = "/api/auth/me/password"

func changeOwn(e *testEnv, token, current, next string) testapi.Response {
	e.T.Helper()
	return e.Do(http.MethodPut, ownPasswordPath, token, map[string]string{"current_password": current, "new_password": next})
}

func passwordHashOf(e *testEnv, userID int64) string {
	e.T.Helper()
	var hash string
	if err := e.Pool.QueryRow(e.T.Context(), "select password_hash from users where id = $1", userID).Scan(&hash); err != nil {
		e.T.Fatal(err)
	}
	return hash
}

// waitForLockWaits waits until n other backends of the test database are
// waiting on a lock: an advisory one when event is "advisory", any other
// (a row or a transaction) when event is empty.
func waitForLockWaits(e *testEnv, event string, n int) {
	e.T.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for {
		var waiting int
		if err := e.Pool.QueryRow(e.T.Context(), `
			select count(*) from pg_stat_activity
			where datname = current_database() and wait_event_type = 'Lock'
			  and (($1 = 'advisory') = (wait_event = 'advisory'))`, event).Scan(&waiting); err != nil {
			e.T.Fatal(err)
		}
		if waiting >= n {
			return
		}
		if time.Now().After(deadline) {
			e.T.Fatalf("timed out waiting for %d lock waits (%q)", n, event)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// pagingEnv is a test database with an administrator named "Zuleica Admin",
// last in the default order, and the administrator's token.
func pagingEnv(t *testing.T) (*testEnv, db.User, string) {
	t.Helper()
	e := newTestEnv(t, nil)
	admin := e.User("admin@exemplo.com", db.UserRoleAdmin, nil)
	e.rename(admin.ID, "Zuleica Admin")
	return e, admin, e.Login("admin@exemplo.com", testPassword)
}

func (e *testEnv) rename(userID int64, name string) {
	e.T.Helper()
	if _, err := e.Pool.Exec(e.T.Context(), "update users set name = $2 where id = $1", userID, name); err != nil {
		e.T.Fatal(err)
	}
}

// seedUser inserts a user straight into the database, with a nickname and an
// e-mail made from the sequence when they are empty.
func (e *testEnv) seedUser(name, nickname, email string, role db.UserRole, sectorID *int64, active bool) int64 {
	e.T.Helper()
	var id int64
	if err := e.Pool.QueryRow(e.T.Context(), `
		insert into users (name, nickname, email, password_hash, role, sector_id, active)
		values ($1, coalesce(nullif($2, ''), 'apelido-' || nextval('users_id_seq')),
		        coalesce(nullif($3, ''), 'u' || nextval('users_id_seq') || '@exemplo.com'),
		        'hash-de-teste', $4, $5, $6)
		returning id`, name, nickname, email, role, sectorID, active).Scan(&id); err != nil {
		e.T.Fatal(err)
	}
	return id
}

// seedNumberedUsers inserts n active agents of the sector named "<prefix> <nn>".
func (e *testEnv) seedNumberedUsers(prefix string, sectorID int64, n int) {
	e.T.Helper()
	for i := 1; i <= n; i++ {
		e.seedUser(fmt.Sprintf("%s %02d", prefix, i), "", "", db.UserRoleAgent, &sectorID, true)
	}
}

func numbered(prefix string, from, to int) []string {
	step := 1
	if to < from {
		step = -1
	}
	var out []string
	for n := from; n != to+step; n += step {
		out = append(out, fmt.Sprintf("%s %02d", prefix, n))
	}
	return out
}

func userPage(e *testEnv, token, query string) ([]map[string]any, testapi.Response) {
	e.T.Helper()
	return e.DoPage("/api/users"+query, token)
}

func userNames(e *testEnv, token, query string) []string {
	e.T.Helper()
	items, _ := userPage(e, token, query)
	return field(items, "name")
}

func field(items []map[string]any, key string) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i], _ = item[key].(string)
	}
	return out
}
