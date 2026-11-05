package db_test

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

func TestCreateAndGetSector(t *testing.T) {
	t.Parallel()
	q := db.New(testdb.New(t))
	ctx := t.Context()

	created, err := q.CreateSector(ctx, db.CreateSectorParams{
		Name:     "Contabilidade",
		Provider: "whatsmeow",
	})
	if err != nil {
		t.Fatal(err)
	}

	got, err := q.GetSector(ctx, created.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Name != "Contabilidade" || got.Phone != nil || got.Provider != "whatsmeow" {
		t.Fatalf("unexpected sector: %+v", got)
	}
	if got.ConnectionStatus != db.ConnectionStatusDisconnected {
		t.Fatalf("connection_status = %q, want %q", got.ConnectionStatus, db.ConnectionStatusDisconnected)
	}
	if !got.Active {
		t.Fatal("new sector should be active")
	}
}

func TestSectorConstraints(t *testing.T) {
	t.Parallel()
	q := db.New(testdb.New(t))
	ctx := t.Context()

	contab, err := q.CreateSector(ctx, db.CreateSectorParams{
		Name: "Contabilidade", Provider: "whatsmeow",
	})
	if err != nil {
		t.Fatal(err)
	}

	cases := []struct {
		name   string
		params db.CreateSectorParams
		code   string
	}{
		{"duplicate name", db.CreateSectorParams{Name: "Contabilidade", Provider: "whatsmeow"}, "23505"},
		{"unknown provider", db.CreateSectorParams{Name: "RH", Provider: "telegram"}, "23514"},
		{"blank name", db.CreateSectorParams{Name: "  ", Provider: "whatsmeow"}, "23514"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := q.CreateSector(ctx, tc.params)
			var pgErr *pgconn.PgError
			if !errors.As(err, &pgErr) || pgErr.Code != tc.code {
				t.Fatalf("err = %v, want SQLSTATE %s", err, tc.code)
			}
		})
	}

	// O telefone é opcional, único quando preenchido e somente dígitos.
	rh, err := q.CreateSector(ctx, db.CreateSectorParams{Name: "RH", Provider: "whatsmeow"})
	if err != nil {
		t.Fatal(err)
	}
	setPhone := func(id int64, phone string) error {
		_, err := q.UpdateSectorConnection(ctx, db.UpdateSectorConnectionParams{
			ID: id, ConnectionStatus: db.ConnectionStatusConnected, Phone: &phone,
		})
		return err
	}
	if err := setPhone(contab.ID, "5511999990000"); err != nil {
		t.Fatal(err)
	}
	for phone, code := range map[string]string{"5511999990000": "23505", "(11) 99999-0002": "23514"} {
		var pgErr *pgconn.PgError
		if err := setPhone(rh.ID, phone); !errors.As(err, &pgErr) || pgErr.Code != code {
			t.Fatalf("phone %q: err = %v, want SQLSTATE %s", phone, err, code)
		}
	}
}

func TestUserAdminSectorConstraint(t *testing.T) {
	t.Parallel()
	pool := testdb.New(t)
	q := db.New(pool)
	ctx := t.Context()

	sector, err := q.CreateSector(ctx, db.CreateSectorParams{
		Name: "Contabilidade", Provider: "whatsmeow",
	})
	if err != nil {
		t.Fatal(err)
	}

	insert := `insert into users (name, nickname, email, password_hash, role, sector_id) values ($1, $2, $2, 'x', $3, $4)`
	cases := []struct {
		name     string
		email    string
		role     string
		sectorID *int64
		wantErr  bool
	}{
		{"admin without sector", "admin@x.com", "admin", nil, false},
		{"admin with sector", "admin2@x.com", "admin", &sector.ID, true},
		{"agent with sector", "agent@x.com", "agent", &sector.ID, false},
		{"agent without sector", "agent2@x.com", "agent", nil, true},
		{"duplicate email ignoring case", "AGENT@x.com", "supervisor", &sector.ID, true},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := pool.Exec(ctx, insert, tc.name, tc.email, tc.role, tc.sectorID)
			if (err != nil) != tc.wantErr {
				t.Fatalf("err = %v, wantErr %v", err, tc.wantErr)
			}
		})
	}
}
