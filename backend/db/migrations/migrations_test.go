package migrations_test

import (
	"database/sql"
	"fmt"
	"slices"
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

// Assuntos e soluções anteriores permanecem intactos e sem módulo na migração.
func TestSubjectModulesPreserveExistingSubjectsAndSolutions(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 24); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into subjects (sector_id, name) values (1, 'Senha'), (1, 'Férias');
		insert into subject_solutions (subject_id, body) values (1, 'Redefinir senha'), (2, 'Consultar calendário');`); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 25); err != nil {
		t.Fatal(err)
	}
	rows, err := db.QueryContext(ctx, `
		select s.name, s.module_id, ss.body from subjects s
		join subject_solutions ss on ss.subject_id = s.id order by s.id`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var got []string
	for rows.Next() {
		var name, solution string
		var moduleID sql.NullInt64
		if err := rows.Scan(&name, &moduleID, &solution); err != nil {
			t.Fatal(err)
		}
		if moduleID.Valid {
			t.Fatalf("legacy subject %s gained module %d", name, moduleID.Int64)
		}
		got = append(got, name+": "+solution)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got, []string{"Senha: Redefinir senha", "Férias: Consultar calendário"}) {
		t.Fatalf("migrated subjects and solutions: %v", got)
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

// Com mais de um módulo no mesmo setor, a migração mantém o mais antigo.
func TestContactModulesKeepOnePerSector(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 16); err != nil {
		t.Fatalf("up to 16: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow'), ('RH', 'whatsmeow');
		insert into modules (sector_id, name) values (1, 'Folha'), (1, 'Patrimônio'), (2, 'Ponto');
		insert into contacts (name, registered) values ('Maria', false);
		insert into contact_sectors (contact_id, sector_id) values (1, 1), (1, 2);
		insert into contact_modules (contact_id, module_id) values (1, 1), (1, 2), (1, 3);`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := p.UpTo(ctx, 17); err != nil {
		t.Fatalf("up to 17: %v", err)
	}
	var got string
	if err := db.QueryRowContext(ctx, `
		select string_agg(module_id || ':' || sector_id, ' ' order by module_id)
		from contact_modules`).Scan(&got); err != nil {
		t.Fatal(err)
	}
	if want := "1:1 3:2"; got != want {
		t.Fatalf("modules = %q, want %q", got, want)
	}
}

// O município do órgão é obrigatório e sem valor padrão: a migração falha em banco com órgãos.
func TestMunicipalitiesFailWithExistingOrganizations(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 18); err != nil {
		t.Fatalf("up to 18: %v", err)
	}
	if _, err := db.ExecContext(ctx, `insert into organizations (name) values ('Prefeitura')`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := p.UpTo(ctx, 19); err == nil {
		t.Fatal("up to 19 with organizations: want an error")
	}
}

// Os usuários existentes recebem o primeiro e o último nome; em caso de repetição,
// sem diferenciar maiúsculas, o menor id fica com o apelido e os demais, com um número.
func TestNicknamesAreFilledFromNames(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 20); err != nil {
		t.Fatalf("up to 20: %v", err)
	}
	names := []string{
		"Ana Maria Souza", // Ana Souza
		"ana souza",       // ana souza 2
		"Ana de Souza",    // Ana Souza 3
		"Bruno",           // Bruno
		"  Carla   Dias ", // Carla Dias
		"Lia 2",           // Lia 2
		"Lia",             // Lia
		"Lia",             // o número 2 já é de outro usuário: Lia 3
	}
	for i, name := range names {
		if _, err := db.ExecContext(ctx, `insert into users (name, email, password_hash, role) values ($1, $2, 'x', 'admin')`,
			name, fmt.Sprintf("u%d@exemplo.com", i)); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}
	var auditBefore int
	if err := db.QueryRowContext(ctx, `select count(*) from audit_logs`).Scan(&auditBefore); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 21); err != nil {
		t.Fatalf("up to 21: %v", err)
	}

	rows, err := db.QueryContext(ctx, `select nickname from users order by id`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var got []string
	for rows.Next() {
		var nickname string
		if err := rows.Scan(&nickname); err != nil {
			t.Fatal(err)
		}
		got = append(got, nickname)
	}
	want := []string{"Ana Souza", "ana souza 2", "Ana Souza 3", "Bruno", "Carla Dias", "Lia 2", "Lia", "Lia 3"}
	if !slices.Equal(got, want) {
		t.Fatalf("nicknames = %q, want %q", got, want)
	}

	var auditAfter int
	if err := db.QueryRowContext(ctx, `select count(*) from audit_logs`).Scan(&auditAfter); err != nil {
		t.Fatal(err)
	}
	if auditAfter != auditBefore {
		t.Fatalf("audit logs: %d before, %d after", auditBefore, auditAfter)
	}

	// As restrições passam a valer para quem vier depois.
	insert := `insert into users (name, nickname, email, password_hash, role) values ('Novo', $1, 'novo@exemplo.com', 'x', 'admin')`
	for _, nickname := range []any{"ANA SOUZA", "  ", nil} {
		if _, err := db.ExecContext(ctx, insert, nickname); err == nil {
			t.Fatalf("insert with nickname %v: want an error", nickname)
		}
	}
}

// A migração 26 apaga Notas internas e "Falou com", inclusive o spoke_with das
// correções em audit_logs, sem tocar no resto da auditoria.
func TestInternalNotesAndSpokeWithAreDropped(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 25); err != nil {
		t.Fatalf("up to 25: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into contacts (name, registered) values ('Maria', false);
		insert into users (name, nickname, email, password_hash, role, sector_id) values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, status, spoke_with, arrived_at, started_at)
		values ('2026-000001', 1, 1, 'queued', 'Maria, esposa', now(), now());
		insert into internal_notes (ticket_id, author_id, body) values (1, 1, 'Cliente pediu retorno à tarde');
		insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, reason, changes) values
		  (1, 'ticket', 1, 'ticket_corrected', 1, 'Só quem atendeu.', '{"spoke_with": {"from": null, "to": "Maria, esposa"}}'),
		  (1, 'ticket', 1, 'ticket_corrected', 1, 'Assunto e quem atendeu.', '{"spoke_with": {"from": null, "to": "João"}, "subject": {"from": "A", "to": "B"}}'),
		  (1, 'ticket', 1, 'ticket_corrected', 1, 'Só o assunto.', '{"subject": {"from": "B", "to": "C"}}'),
		  (1, 'ticket', 1, 'ticket_transferred', 1, null, '{"spoke_with": "intocado"}');`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := p.UpTo(ctx, 26); err != nil {
		t.Fatalf("up to 26: %v", err)
	}

	var exists int
	if err := db.QueryRowContext(ctx, `
		select (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'internal_notes')
		     + (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'tickets' and column_name = 'spoke_with')`).Scan(&exists); err != nil {
		t.Fatal(err)
	}
	if exists != 0 {
		t.Fatalf("internal_notes or tickets.spoke_with still exist")
	}

	rows, err := db.QueryContext(ctx, `select action || ' | ' || reason_text || ' | ' || changes::text from (
		select action, coalesce(reason, '-') as reason_text, changes, id from audit_logs) a order by id`)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = rows.Close() }()
	var got []string
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			t.Fatal(err)
		}
		got = append(got, line)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	want := []string{
		`ticket_corrected | Assunto e quem atendeu. | {"subject": {"to": "B", "from": "A"}}`,
		`ticket_corrected | Só o assunto. | {"subject": {"to": "C", "from": "B"}}`,
		`ticket_transferred | - | {"spoke_with": "intocado"}`,
	}
	if !slices.Equal(got, want) {
		t.Fatalf("audit_logs after migration:\n got %q\nwant %q", got, want)
	}
}

// A transferência sem formulário (00029) dispensa órgão, assunto e resolução
// só na etapa transferida; as transferências antigas, com o formulário,
// continuam válidas.
func TestSectorTransferWithoutFormRelaxesOnlyTransfers(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 28); err != nil {
		t.Fatalf("up to 28: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into organizations (name, municipality_id) select 'Prefeitura', min(id) from municipalities;
		insert into contacts (name, registered, organization_id) select 'Maria', false, id from organizations;
		insert into contacts (name, registered) values ('João', false);
		insert into users (name, nickname, email, password_hash, role, sector_id) values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at, subject, resolution)
		select '2026-000001', 1, 1, id, 'closed', 1, 1, 'transferred', now(), now(), now(), now(), 'Contracheque', 'Segunda via' from organizations;`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if _, err := p.UpTo(ctx, 29); err != nil {
		t.Fatalf("up to 29: %v", err)
	}

	if _, err := db.ExecContext(ctx, `
		insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at, transfer_reason)
		values ('2026-000002', 1, 2, 'closed', 1, 1, 'transferred', now(), now(), now(), now(), 'É com o RH')`); err != nil {
		t.Fatalf("transfer without form: %v", err)
	}
	for name, stmt := range map[string]string{
		"resolved without form": `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at)
			values ('2026-000003', 1, 2, 'closed', 1, 1, 'resolved', now(), now(), now(), now())`,
		"blank reason": `update tickets set transfer_reason = ' ' where protocol = '2026-000001'`,
	} {
		if _, err := db.ExecContext(ctx, stmt); err == nil {
			t.Fatalf("%s: accepted", name)
		}
	}
	var n int
	if err := db.QueryRowContext(ctx, `select count(*) from tickets where closure_type = 'transferred'`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 2 {
		t.Fatalf("transferred tickets = %d", n)
	}
}
