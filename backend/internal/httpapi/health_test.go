package httpapi_test

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/httpapi"
)

func TestHealth(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	srv := httptest.NewServer(httpapi.NewRouter(logger, nil, nil, nil, nil, nil, nil, httpapi.Options{}))
	defer srv.Close()

	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, srv.URL+"/health", nil)
	if err != nil {
		t.Fatal(err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want %d", resp.StatusCode, http.StatusOK)
	}

	var body map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body["status"] != "ok" {
		t.Fatalf("status field = %q, want %q", body["status"], "ok")
	}
}
