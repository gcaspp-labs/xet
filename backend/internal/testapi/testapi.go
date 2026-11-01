// Package testapi starts the API on a real database for the integration tests,
// with the helpers shared by the tests of every module.
package testapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/directory"
	"github.com/gcaspp-labs/xet/backend/internal/core/realtime"
	"github.com/gcaspp-labs/xet/backend/internal/core/sectors"
	"github.com/gcaspp-labs/xet/backend/internal/core/storage"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk"
	"github.com/gcaspp-labs/xet/backend/internal/helpdesk/messaging/fake"
	"github.com/gcaspp-labs/xet/backend/internal/server"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

const Password = "Senha@123"

type Env struct {
	T             *testing.T
	Pool          *pgxpool.Pool
	Q             *db.Queries
	URL           string
	Sectors       *sectors.Service
	TicketService *helpdesk.Service
	// WhatsApp simulates the phones of the sector numbers.
	WhatsApp *fake.Adapter
	// Files holds the attachments of the messages.
	Files storage.Storage
}

// New starts the API on a fresh database. extra registers routes used only by
// the test, behind the same session middleware as the real ones.
func New(t *testing.T, extra func(a *auth.Handler, r chi.Router)) *Env {
	t.Helper()
	return Start(t, testdb.New(t), extra)
}

// Start starts the API on the database; a second call on the same database
// simulates a restart of the service.
func Start(t *testing.T, pool *pgxpool.Pool, extra func(a *auth.Handler, r chi.Router)) *Env {
	t.Helper()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	hub := realtime.NewHub()
	sectorService := sectors.NewService(pool)
	files := storage.NewDisk(t.TempDir())
	tickets := helpdesk.NewService(pool, files, hub)
	whatsapp := fake.New(tickets.HandleEvent)
	tickets.SetProvider(whatsapp)
	t.Cleanup(tickets.Wait)
	handler := server.NewRouter(logger, server.Services{
		Auth: auth.NewService(pool), Users: users.NewService(pool), Sectors: sectorService, Directory: directory.NewService(pool), Helpdesk: tickets, Hub: hub,
	}, server.Options{
		SecureCookie: true, Messaging: whatsapp, SessionCheckInterval: 200 * time.Millisecond,
	})
	if extra != nil {
		a := auth.NewHandler(logger, auth.NewService(pool), true)
		r := chi.NewRouter()
		r.Mount("/", handler)
		r.Route("/test", func(r chi.Router) { extra(a, r) })
		handler = r
	}
	srv := httptest.NewServer(handler)
	t.Cleanup(srv.Close)
	return &Env{T: t, Pool: pool, Q: db.New(pool), URL: srv.URL, Sectors: sectorService, TicketService: tickets, WhatsApp: whatsapp, Files: files}
}

func (e *Env) Sector(name string) db.Sector {
	e.T.Helper()
	s, err := e.Q.CreateSector(e.T.Context(), db.CreateSectorParams{Name: name, Provider: "whatsmeow"})
	if err != nil {
		e.T.Fatal(err)
	}
	return s
}

func (e *Env) User(email string, role db.UserRole, sectorID *int64) db.User {
	e.T.Helper()
	hash, err := users.HashPassword(Password)
	if err != nil {
		e.T.Fatal(err)
	}
	u, err := e.Q.CreateUser(e.T.Context(), db.CreateUserParams{
		Name: email, Email: email, PasswordHash: hash, Role: role, SectorID: sectorID,
	})
	if err != nil {
		e.T.Fatal(err)
	}
	return u
}

type Response struct {
	Status  int
	Body    map[string]any
	Cookies []*http.Cookie
}

func (e *Env) Do(method, path, token string, body any) Response {
	e.T.Helper()
	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			e.T.Fatal(err)
		}
		reader = bytes.NewReader(b)
	}
	req, err := http.NewRequestWithContext(e.T.Context(), method, e.URL+path, reader)
	if err != nil {
		e.T.Fatal(err)
	}
	if token != "" {
		req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.T.Fatal(err)
	}
	defer resp.Body.Close()
	out := Response{Status: resp.StatusCode, Cookies: resp.Cookies()}
	raw, _ := io.ReadAll(resp.Body)
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &out.Body)
	}
	return out
}

// Login returns the session token of a successful login.
func (e *Env) Login(email, password string) string {
	e.T.Helper()
	resp := e.Do(http.MethodPost, "/api/auth/login", "", map[string]string{"email": email, "password": password})
	if resp.Status != http.StatusOK {
		e.T.Fatalf("login %s: status %d, body %v", email, resp.Status, resp.Body)
	}
	for _, c := range resp.Cookies {
		if c.Name == auth.SessionCookie {
			return c.Value
		}
	}
	e.T.Fatalf("login %s: no session cookie", email)
	return ""
}

// AuditChanges returns the actions and decoded changes recorded for an entity.
func (e *Env) AuditChanges(entityType string, entityID int64) ([]string, []map[string]map[string]any) {
	e.T.Helper()
	logs, err := e.Q.ListAuditLogsByEntity(e.T.Context(), db.ListAuditLogsByEntityParams{EntityType: entityType, EntityID: entityID})
	if err != nil {
		e.T.Fatal(err)
	}
	actions := make([]string, len(logs))
	changes := make([]map[string]map[string]any, len(logs))
	for i, l := range logs {
		actions[i] = l.Action
		if err := json.Unmarshal(l.Changes, &changes[i]); err != nil {
			e.T.Fatalf("audit changes %s: %v", l.Changes, err)
		}
	}
	return actions, changes
}

// DoList performs a request whose response is a JSON array.
func (e *Env) DoList(method, path, token string) []map[string]any {
	e.T.Helper()
	req, err := http.NewRequestWithContext(e.T.Context(), method, e.URL+path, nil)
	if err != nil {
		e.T.Fatal(err)
	}
	req.AddCookie(&http.Cookie{Name: auth.SessionCookie, Value: token})
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		e.T.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		e.T.Fatalf("%s %s: status %d", method, path, resp.StatusCode)
	}
	var out []map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		e.T.Fatal(err)
	}
	return out
}

func (e *Env) Organization(token, name, cnpj string) int64 {
	e.T.Helper()
	resp := e.Do(http.MethodPost, "/api/organizations", token, map[string]string{"name": name, "cnpj": cnpj})
	if resp.Status != http.StatusCreated {
		e.T.Fatalf("create organization %s: status %d, body %v", name, resp.Status, resp.Body)
	}
	return ID(resp.Body)
}

func (e *Env) Contact(token, name, phone string, orgID, sectorID int64) int64 {
	e.T.Helper()
	resp := e.Do(http.MethodPost, "/api/contacts", token, map[string]any{"name": name, "phone": phone, "organizationId": orgID, "sectorIds": []int64{sectorID}})
	if resp.Status != http.StatusCreated {
		e.T.Fatalf("create contact %s: status %d, body %v", name, resp.Status, resp.Body)
	}
	return ID(resp.Body)
}

// Count returns the number of rows of a table.
func (e *Env) Count(table string) int {
	e.T.Helper()
	var n int
	if err := e.Pool.QueryRow(e.T.Context(), "select count(*) from "+table).Scan(&n); err != nil {
		e.T.Fatal(err)
	}
	return n
}

// Names lists the names of a response array.
func Names(list []map[string]any) []string {
	out := make([]string, len(list))
	for i, item := range list {
		out[i], _ = item["name"].(string)
	}
	return out
}

// ID reads the id of a response body.
func ID(body map[string]any) int64 {
	v, _ := body["id"].(float64)
	return int64(v)
}
