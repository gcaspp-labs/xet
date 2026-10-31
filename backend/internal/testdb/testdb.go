// Package testdb provides isolated PostgreSQL databases for integration tests.
//
// A single PostgreSQL container is started per test binary. Migrations are
// applied once to a template database, and each test gets its own database
// cloned from that template, so tests never share state.
package testdb

import (
	"context"
	"database/sql"
	"fmt"
	"net/url"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"
	_ "github.com/jackc/pgx/v5/stdlib" // database/sql driver used by goose
	"github.com/testcontainers/testcontainers-go/modules/postgres"

	"github.com/gcaspp-labs/xet/backend/db/migrations"
)

const (
	image        = "postgres:17-alpine"
	templateName = "xet_template"
)

var (
	setupOnce sync.Once
	setupErr  error
	baseURL   *url.URL
	counter   atomic.Int64
)

// New returns a connection pool to a fresh database with all migrations applied.
func New(t testing.TB) *pgxpool.Pool {
	t.Helper()
	dsn := createDatabase(t, templateName)

	pool, err := pgxpool.New(t.Context(), dsn)
	if err != nil {
		t.Fatalf("testdb: connect: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

// NewEmptyDSN returns the connection string of a fresh database without migrations.
func NewEmptyDSN(t testing.TB) string {
	t.Helper()
	return createDatabase(t, "template0")
}

func createDatabase(t testing.TB, template string) string {
	t.Helper()
	setupOnce.Do(func() { setupErr = setup(context.Background()) })
	if setupErr != nil {
		t.Fatalf("testdb: setup: %v", setupErr)
	}

	name := fmt.Sprintf("test_%d", counter.Add(1))
	admin := openAdmin(t)
	if _, err := admin.ExecContext(t.Context(), fmt.Sprintf("create database %s template %s", name, template)); err != nil {
		t.Fatalf("testdb: create database: %v", err)
	}

	t.Cleanup(func() {
		ctx := context.Background()
		if _, err := admin.ExecContext(ctx, fmt.Sprintf("drop database if exists %s with (force)", name)); err != nil {
			t.Errorf("testdb: drop database: %v", err)
		}
		_ = admin.Close()
	})

	return dsnFor(name)
}

func setup(ctx context.Context) error {
	ctr, err := postgres.Run(ctx, image,
		postgres.WithDatabase("postgres"),
		postgres.WithUsername("postgres"),
		postgres.WithPassword("postgres"),
		postgres.BasicWaitStrategies(),
	)
	if err != nil {
		return fmt.Errorf("start container: %w", err)
	}

	raw, err := ctr.ConnectionString(ctx, "sslmode=disable")
	if err != nil {
		return fmt.Errorf("connection string: %w", err)
	}
	if baseURL, err = url.Parse(raw); err != nil {
		return fmt.Errorf("parse connection string: %w", err)
	}

	admin, err := sql.Open("pgx", dsnFor("postgres"))
	if err != nil {
		return err
	}
	defer admin.Close()
	if _, err := admin.ExecContext(ctx, "create database "+templateName); err != nil {
		return fmt.Errorf("create template: %w", err)
	}

	tmpl, err := sql.Open("pgx", dsnFor(templateName))
	if err != nil {
		return err
	}
	defer tmpl.Close()
	return migrations.Up(ctx, tmpl)
}

func openAdmin(t testing.TB) *sql.DB {
	t.Helper()
	admin, err := sql.Open("pgx", dsnFor("postgres"))
	if err != nil {
		t.Fatalf("testdb: open admin: %v", err)
	}
	return admin
}

func dsnFor(database string) string {
	u := *baseURL
	u.Path = "/" + database
	return u.String()
}
