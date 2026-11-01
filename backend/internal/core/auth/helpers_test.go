package auth_test

import (
	"testing"

	"github.com/go-chi/chi/v5"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/testapi"
)

const testPassword = testapi.Password

type testEnv struct{ *testapi.Env }

func newTestEnv(t *testing.T, extra func(a *auth.Handler, r chi.Router)) *testEnv {
	t.Helper()
	return &testEnv{testapi.New(t, extra)}
}
