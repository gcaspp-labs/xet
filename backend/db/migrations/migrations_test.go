package migrations_test

import (
	"database/sql"
	"testing"

	"github.com/gcaspp-labs/xet/backend/db/migrations"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

func TestMigrationsUpAndDown(t *testing.T) {
	db, err := sql.Open("pgx", testdb.NewEmptyDSN(t))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p, err := migrations.NewProvider(db)
	if err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()

	if _, err := p.Up(ctx); err != nil {
		t.Fatalf("up: %v", err)
	}
	if _, err := p.DownTo(ctx, 0); err != nil {
		t.Fatalf("down: %v", err)
	}

	var tables int
	err = db.QueryRowContext(ctx,
		`select count(*) from information_schema.tables
		 where table_schema = 'public' and table_name <> 'goose_db_version'`).Scan(&tables)
	if err != nil {
		t.Fatal(err)
	}
	if tables != 0 {
		t.Fatalf("tables after down = %d, want 0", tables)
	}

	if _, err := p.Up(ctx); err != nil {
		t.Fatalf("up again: %v", err)
	}
}

// A migração dos setores do contato preenche os vínculos a partir dos chamados:
// sem repetir o setor e deixando sem setor o contato sem chamado.
func TestContactSectorsAreFilledFromTickets(t *testing.T) {
	db, err := sql.Open("pgx", testdb.NewEmptyDSN(t))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	p, err := migrations.NewProvider(db)
	if err != nil {
		t.Fatal(err)
	}
	ctx := t.Context()
	if _, err := p.UpTo(ctx, 15); err != nil {
		t.Fatalf("up to 15: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow'), ('RH', 'whatsmeow');
		insert into contacts (name, registered) values ('Maria', false), ('João', false), ('Sem chamado', false);
		insert into users (name, email, password_hash, role, sector_id) values ('Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at)
		values ('2026-000001', 1, 1, 'closed', 1, 1, 'cancelled', now(), now(), now(), now());
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000002', 1, 1, 'queued', now(), now()),
		       ('2026-000003', 2, 1, 'queued', now(), now()),
		       ('2026-000004', 2, 2, 'queued', now(), now());`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := p.UpTo(ctx, 16); err != nil {
		t.Fatalf("up to 16: %v", err)
	}

	var got string
	if err := db.QueryRowContext(ctx, `
		select string_agg(contact_id || ':' || sector_id, ' ' order by contact_id, sector_id)
		from contact_sectors`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := "1:1 1:2 2:2"; got != want {
		t.Fatalf("links = %q, want %q", got, want)
	}
}
