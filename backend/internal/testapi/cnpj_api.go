package testapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

// FakeCNPJAPI stands in for the CNPJ lookup API: it answers 404 to a CNPJ with
// no response set and never lets a test reach the real service.
type FakeCNPJAPI struct {
	srv       *httptest.Server
	mu        sync.Mutex
	responses map[string]func(w http.ResponseWriter)
	calls     []string
}

func newFakeCNPJAPI(t *testing.T) *FakeCNPJAPI {
	t.Helper()
	f := &FakeCNPJAPI{responses: map[string]func(w http.ResponseWriter){}}
	f.srv = httptest.NewServer(http.HandlerFunc(f.serve))
	t.Cleanup(f.srv.Close)
	return f
}

func (f *FakeCNPJAPI) URL() string { return f.srv.URL }

// Respond sets the status and raw body answered for the CNPJ.
func (f *FakeCNPJAPI) Respond(cnpj string, status int, body string) {
	f.set(cnpj, func(w http.ResponseWriter) {
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	})
}

// Drop makes the API close the connection without answering for the CNPJ.
func (f *FakeCNPJAPI) Drop(cnpj string) {
	f.set(cnpj, func(http.ResponseWriter) { panic(http.ErrAbortHandler) })
}

// Calls returns the CNPJs asked of the API so far.
func (f *FakeCNPJAPI) Calls() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.calls...)
}

func (f *FakeCNPJAPI) set(cnpj string, respond func(w http.ResponseWriter)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.responses[cnpj] = respond
}

func (f *FakeCNPJAPI) serve(w http.ResponseWriter, r *http.Request) {
	cnpj := strings.TrimPrefix(r.URL.Path, "/")
	f.mu.Lock()
	f.calls = append(f.calls, cnpj)
	respond, ok := f.responses[cnpj]
	f.mu.Unlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	respond(w)
}
