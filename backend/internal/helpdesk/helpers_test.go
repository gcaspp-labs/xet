package helpdesk_test

import (
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/testapi"
)

const testPassword = testapi.Password

type response = testapi.Response

var (
	id    = testapi.ID
	names = testapi.Names
)

type testEnv struct{ *testapi.Env }

func newTestEnv(t *testing.T, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.New(t, extra)}
}

func startServer(t *testing.T, pool *pgxpool.Pool, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.Start(t, pool, extra)}
}
