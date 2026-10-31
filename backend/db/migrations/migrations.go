// Package migrations embeds the goose SQL migrations and applies them.
package migrations

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/pressly/goose/v3"
)

//go:embed *.sql
var files embed.FS

// NewProvider returns a goose provider for the embedded migrations.
func NewProvider(db *sql.DB) (*goose.Provider, error) {
	p, err := goose.NewProvider(goose.DialectPostgres, db, files)
	if err != nil {
		return nil, fmt.Errorf("goose provider: %w", err)
	}
	return p, nil
}

// Up applies all pending migrations.
func Up(ctx context.Context, db *sql.DB) error {
	p, err := NewProvider(db)
	if err != nil {
		return err
	}
	if _, err := p.Up(ctx); err != nil {
		return fmt.Errorf("apply migrations: %w", err)
	}
	return nil
}
