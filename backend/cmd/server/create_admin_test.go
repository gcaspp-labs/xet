package main

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/gcaspp-labs/xet/backend/internal/core/auth"
	"github.com/gcaspp-labs/xet/backend/internal/core/users"
	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

func TestCreateAdmin(t *testing.T) {
	t.Parallel()
	pool := testdb.New(t)
	svc := users.NewService(pool)
	ctx := t.Context()
	args := []string{"-name", "Maria Admin", "-email", "maria@exemplo.com"}

	var out bytes.Buffer
	if err := createAdmin(ctx, svc, args, strings.NewReader("Cofre#Azul47\n"), &out); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out.String(), "maria@exemplo.com") {
		t.Fatalf("output: %q", out.String())
	}

	_, user, _, err := auth.NewService(pool).Login(ctx, "maria@exemplo.com", "Cofre#Azul47", "192.0.2.1")
	if err != nil {
		t.Fatal(err)
	}
	if user.Role != db.UserRoleAdmin || user.SectorID != nil {
		t.Fatalf("created user: %+v", user)
	}

	logs, err := db.New(pool).ListAuditLogsByEntity(ctx, db.ListAuditLogsByEntityParams{EntityType: "user", EntityID: user.ID})
	if err != nil {
		t.Fatal(err)
	}
	if len(logs) != 1 || logs[0].Action != "user_created" || logs[0].ActorID != nil {
		t.Fatalf("audit logs: %+v", logs)
	}

	// O apelido vem do nome, e a auditoria o registra.
	var nickname string
	if err := pool.QueryRow(ctx, "select nickname from users where id = $1", user.ID).Scan(&nickname); err != nil {
		t.Fatal(err)
	}
	if nickname != "Maria Admin" || !strings.Contains(string(logs[0].Changes), "Maria Admin") {
		t.Fatalf("nickname %q, audit changes %s", nickname, logs[0].Changes)
	}

	cases := []struct {
		name  string
		args  []string
		stdin string
	}{
		{"duplicate email", []string{"-name", "Outra", "-email", "MARIA@exemplo.com"}, "Cofre#Azul47\n"},
		{"duplicate nickname", []string{"-name", "Maria da Silva Admin", "-email", "outra@exemplo.com"}, "Cofre#Azul47\n"},
		{"weak password", []string{"-name", "Outra", "-email", "outra@exemplo.com"}, "fraca\n"},
		{"missing email", []string{"-name", "Outra"}, "Cofre#Azul47\n"},
		{"common password", []string{"-name", "Outra", "-email", "outra@exemplo.com"}, "Senha@123\n"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := createAdmin(context.Background(), svc, tc.args, strings.NewReader(tc.stdin), &bytes.Buffer{}); err == nil {
				t.Fatal("expected error")
			}
		})
	}
}
