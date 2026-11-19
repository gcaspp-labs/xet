package users_test

import (
	"net/http"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
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
