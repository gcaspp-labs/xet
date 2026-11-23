package migrations_test

import (
	"database/sql"
	"fmt"
	"slices"
	"testing"
	"time"

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

// As alterações de mensagens (#291) chegam sem mexer nas mensagens gravadas, e
// voltar à migração anterior devolve as mensagens como estavam.
func TestMessageChangesKeepMessagesUpAndDown(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 29); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into contacts (name, registered) values ('Maria', false);
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000001', 1, 1, 'queued', now(), now());
		insert into messages (ticket_id, sector_id, contact_id, direction, origin, type, body, external_message_id, sent_at)
		values (1, 1, 1, 'inbound', 'customer', 'text', 'Oi', 'IN-1', now());`); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 30); err != nil {
		t.Fatal(err)
	}
	var state string
	if err := db.QueryRowContext(ctx, `
		select body || ' | ' || (edited_at is null) || ' | ' || (deleted_at is null) from messages where id = 1`).Scan(&state); err != nil {
		t.Fatal(err)
	}
	if state != "Oi | true | true" {
		t.Fatalf("message after up = %q", state)
	}
	// Exclusão parcial (sem alcance ou origem) é recusada pelo banco.
	if _, err := db.ExecContext(ctx, `update messages set deleted_at = now() where id = 1`); err == nil {
		t.Fatal("deletion without scope and origin accepted")
	}
	if _, err := db.ExecContext(ctx, `
		insert into message_changes (sector_id, message_id, target_external_message_id, kind, origin, body, occurred_at)
		values (1, 1, 'IN-1', 'original', 'customer', 'Oi', now()), (1, 1, 'IN-1', 'edit', 'customer', 'Olá', now());
		update messages set body = 'Olá', edited_at = now(), deleted_at = now(), deletion_scope = 'everyone', deletion_origin = 'customer' where id = 1;`); err != nil {
		t.Fatal(err)
	}
	if _, err := p.DownTo(ctx, 29); err != nil {
		t.Fatalf("down: %v", err)
	}
	var columns int
	if err := db.QueryRowContext(ctx, `
		select count(*) from information_schema.columns
		where table_schema = 'public' and table_name = 'messages'
		  and column_name in ('edited_at', 'deleted_at', 'deletion_scope', 'deletion_origin')`).Scan(&columns); err != nil {
		t.Fatal(err)
	}
	var messages int
	if err := db.QueryRowContext(ctx, `select count(*) from messages`).Scan(&messages); err != nil {
		t.Fatal(err)
	}
	if columns != 0 || messages != 1 {
		t.Fatalf("after down: %d columns left, %d messages", columns, messages)
	}
	if _, err := p.Up(ctx); err != nil {
		t.Fatalf("up again: %v", err)
	}
}

// O canal (#316) chega com o padrão WhatsApp nos chamados existentes, sem
// mudar mais nada neles; o registro por telefone só existe encerrado, e a
// volta recusa apagar registros por telefone.
func TestTicketChannelKeepsExistingTicketsAsWhatsApp(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 31); err != nil {
		t.Fatalf("up to 31: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into organizations (name, municipality_id) select 'Prefeitura', min(id) from municipalities;
		insert into contacts (name, phone, registered, organization_id) select 'Maria', '5511988887777', true, id from organizations;
		insert into contacts (name, registered) values ('João', false);
		insert into users (name, nickname, email, password_hash, role, sector_id) values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at, subject, resolution)
		select '2026-000001', 1, 1, id, 'closed', 1, 1, 'resolved', now(), now(), now() - interval '1 hour', now() - interval '1 hour', 'Contracheque', 'Segunda via' from organizations;
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000002', 1, 2, 'queued', now(), now());`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	const snapshot = `select string_agg(row_to_json(t)::text, '|' order by id) from (
		select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id,
		    arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution,
		    created_at, updated_at, transfer_reason from tickets) t`
	var before, after string
	if err := db.QueryRowContext(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 32); err != nil {
		t.Fatalf("up to 32: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("tickets changed:\nbefore %s\nafter  %s", before, after)
	}
	var whatsapp, withRequest int
	if err := db.QueryRowContext(ctx, `select count(*) filter (where channel = 'whatsapp'), count(client_request_id) from tickets`).Scan(&whatsapp, &withRequest); err != nil {
		t.Fatal(err)
	}
	if whatsapp != 2 || withRequest != 0 {
		t.Fatalf("whatsapp = %d, with request id = %d", whatsapp, withRequest)
	}

	// O registro por telefone só existe encerrado normalmente, e a chave é única.
	for name, stmt := range map[string]string{
		"open phone ticket": `insert into tickets (protocol, sector_id, contact_id, status, channel, arrived_at, started_at)
			values ('2026-000003', 1, 1, 'queued', 'phone', now(), now())`,
		"cancelled phone ticket": `insert into tickets (protocol, sector_id, contact_id, status, channel, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at)
			values ('2026-000003', 1, 1, 'closed', 'phone', 1, 1, 'cancelled', now(), now(), now(), now())`,
	} {
		if _, err := db.ExecContext(ctx, stmt); err == nil {
			t.Fatalf("%s: accepted", name)
		}
	}
	const phone = `insert into tickets (protocol, sector_id, contact_id, organization_id, status, channel, client_request_id, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at, subject, resolution)
		select $1, 1, 1, id, 'closed', 'phone', '6f1b6d3e-1d0a-4f5b-9c1e-0a1b2c3d4e5f', 1, 1, 'resolved', now(), now(), now(), now(), 'Senha', 'Orientado' from organizations`

	// Sem registro por telefone, a volta desfaz tudo; com um, é recusada.
	if _, err := p.DownTo(ctx, 31); err != nil {
		t.Fatalf("down to 31: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("tickets changed by down:\nbefore %s\nafter  %s", before, after)
	}
	if _, err := p.UpTo(ctx, 32); err != nil {
		t.Fatalf("up again: %v", err)
	}
	if _, err := db.ExecContext(ctx, phone, "2026-000003"); err != nil {
		t.Fatalf("phone ticket: %v", err)
	}
	if _, err := db.ExecContext(ctx, phone, "2026-000004"); err == nil {
		t.Fatal("repeated client_request_id: accepted")
	}
	if _, err := p.DownTo(ctx, 31); err == nil {
		t.Fatal("down with a phone ticket: accepted")
	}
}

// Os cartões de contato (#323) chegam sem mudar as mensagens existentes: a
// antiga 'unsupported' continua 'unsupported' e sem cartões. Só a mensagem
// 'contact' tem cartões, sempre ao menos um, e a volta recusa apagá-los.
func TestContactCardsKeepExistingMessages(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 32); err != nil {
		t.Fatalf("up to 32: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into contacts (name, registered) values ('Maria', false);
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000001', 1, 1, 'queued', now(), now());
		insert into messages (ticket_id, sector_id, contact_id, direction, origin, type, body, external_message_id, sent_at)
		values (1, 1, 1, 'inbound', 'customer', 'text', 'Oi', 'IN-1', now()),
		       (1, 1, 1, 'inbound', 'customer', 'unsupported', null, 'IN-2', now());`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	const snapshot = `select string_agg(row_to_json(m)::text, '|' order by id) from (
		select id, ticket_id, sector_id, contact_id, direction, origin, author_id, type, body, media_id, external_message_id,
		    client_request_id, status, failure_reason, sent_at, created_at, quoted_external_message_id, quoted_message_id,
		    quoted_type, quoted_body, edited_at, deleted_at, deletion_scope, deletion_origin from messages) m`
	var before, after string
	if err := db.QueryRowContext(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 34); err != nil {
		t.Fatalf("up to 34: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("messages changed:\nbefore %s\nafter  %s", before, after)
	}
	var unsupported, withCards int
	if err := db.QueryRowContext(ctx, `
		select count(*) filter (where type = 'unsupported'), count(contact_cards) from messages`).Scan(&unsupported, &withCards); err != nil {
		t.Fatal(err)
	}
	if unsupported != 1 || withCards != 0 {
		t.Fatalf("unsupported = %d, with cards = %d", unsupported, withCards)
	}

	const insert = `insert into messages (ticket_id, sector_id, contact_id, direction, origin, type, external_message_id, sent_at, contact_cards)
		values (1, 1, 1, 'inbound', 'customer', $1, $2, now(), $3::jsonb)`
	for name, args := range map[string][]any{
		"contact without cards":   {"contact", "IN-3", nil},
		"contact with empty list": {"contact", "IN-3", `[]`},
		"contact with object":     {"contact", "IN-3", `{"name": "João"}`},
		"text with cards":         {"text", "IN-3", `[{"name": "João", "phones": []}]`},
		"unsupported with cards":  {"unsupported", "IN-3", `[{"name": "João", "phones": []}]`},
	} {
		if _, err := db.ExecContext(ctx, insert, args...); err == nil {
			t.Fatalf("%s: accepted", name)
		}
	}

	// Sem mensagem de contato, a volta desfaz tudo; com uma, é recusada.
	if _, err := p.DownTo(ctx, 32); err != nil {
		t.Fatalf("down to 32: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("messages changed by down:\nbefore %s\nafter  %s", before, after)
	}
	if _, err := p.UpTo(ctx, 34); err != nil {
		t.Fatalf("up again: %v", err)
	}
	if _, err := db.ExecContext(ctx, insert, "contact", "IN-3",
		`[{"name": "João", "organization": "Prefeitura", "phones": [{"phone": "5511977776666", "wa_id": "5511977776666"}]}]`); err != nil {
		t.Fatalf("contact message: %v", err)
	}
	if _, err := p.DownTo(ctx, 32); err == nil {
		t.Fatal("down with a contact message: accepted")
	}
}

// O chamado pendente e o mesclado (#333) chegam sem mudar os chamados
// existentes. Depois, um contato pode ter vários pendentes e um chamado na
// fila ou em atendimento no setor; o pendente fica sem responsável, com
// motivo, quem marcou e quando, e o mesclado aponta para outro chamado, sem
// assunto nem resolução. A volta desfaz tudo, e é recusada com um pendente.
func TestTicketPendingKeepsExistingTickets(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 34); err != nil {
		t.Fatalf("up to 34: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into organizations (name, municipality_id) select 'Prefeitura', min(id) from municipalities;
		insert into contacts (name, phone, registered, organization_id) select 'Maria', '5511988887777', true, id from organizations;
		insert into contacts (name, registered) values ('João', false), ('Rita', false);
		insert into users (name, nickname, email, password_hash, role, sector_id) values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at, subject, resolution)
		select '2026-000001', 1, 1, id, 'closed', 1, 1, 'resolved', now(), now(), now() - interval '1 hour', now() - interval '1 hour', 'Contracheque', 'Segunda via' from organizations;
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000002', 1, 2, 'queued', now(), now());
		insert into tickets (protocol, sector_id, contact_id, status, assignee_id, arrived_at, assigned_at, started_at)
		values ('2026-000003', 1, 3, 'in_progress', 1, now(), now(), now());`); err != nil {
		t.Fatalf("seed: %v", err)
	}
	const snapshot = `select string_agg(row_to_json(t)::text, '|' order by id) from (
		select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id,
		    arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution,
		    created_at, updated_at, transfer_reason, channel, client_request_id from tickets) t`
	var before, after string
	if err := db.QueryRowContext(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := p.UpTo(ctx, 36); err != nil {
		t.Fatalf("up to 36: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("tickets changed:\nbefore %s\nafter  %s", before, after)
	}
	var filled int
	if err := db.QueryRowContext(ctx, `select count(*) from tickets
		where pending_reason is not null or pending_by_id is not null or pending_at is not null or merged_into_ticket_id is not null`).Scan(&filled); err != nil {
		t.Fatal(err)
	}
	if filled != 0 {
		t.Fatalf("existing tickets with pending or merged fields: %d", filled)
	}

	// O chamado em atendimento fica pendente; o contato passa a ter outro na
	// fila e, ao mesmo tempo, mais um pendente.
	const pending = `update tickets set status = 'pending', assignee_id = null,
		pending_reason = 'Aguardando ajuste', pending_by_id = 1, pending_at = now() where protocol = $1`
	if _, err := db.ExecContext(ctx, pending, "2026-000003"); err != nil {
		t.Fatalf("pending: %v", err)
	}
	if _, err := db.ExecContext(ctx, `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, arrived_at, assigned_at, started_at)
		values ('2026-000004', 1, 3, 'in_progress', 1, now(), now(), now())`); err != nil {
		t.Fatalf("in progress beside a pending: %v", err)
	}
	if _, err := db.ExecContext(ctx, pending, "2026-000004"); err != nil {
		t.Fatalf("second pending: %v", err)
	}
	if _, err := db.ExecContext(ctx, `insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000005', 1, 3, 'queued', now(), now())`); err != nil {
		t.Fatalf("queued beside two pending: %v", err)
	}
	// O mesclado aponta para o pendente, sem órgão, assunto nem resolução.
	if _, err := db.ExecContext(ctx, `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, merged_into_ticket_id, closed_at, ended_at, arrived_at, started_at)
		values ('2026-000006', 1, 2, 'closed', 1, 1, 'merged', 3, now(), now(), now(), now())`); err != nil {
		t.Fatalf("merged: %v", err)
	}

	for name, stmt := range map[string]string{
		"second open ticket": `insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
			values ('2026-000007', 1, 3, 'queued', now(), now())`,
		"pending without reason": `insert into tickets (protocol, sector_id, contact_id, status, pending_by_id, pending_at, arrived_at, started_at)
			values ('2026-000007', 1, 2, 'pending', 1, now(), now(), now())`,
		"pending with blank reason": `insert into tickets (protocol, sector_id, contact_id, status, pending_reason, pending_by_id, pending_at, arrived_at, started_at)
			values ('2026-000007', 1, 2, 'pending', '  ', 1, now(), now(), now())`,
		"pending without who marked": `insert into tickets (protocol, sector_id, contact_id, status, pending_reason, pending_at, arrived_at, started_at)
			values ('2026-000007', 1, 2, 'pending', 'Aguardando', now(), now(), now())`,
		"pending assigned": `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, pending_reason, pending_by_id, pending_at, arrived_at, started_at)
			values ('2026-000007', 1, 2, 'pending', 1, 'Aguardando', 1, now(), now(), now())`,
		"merged without target": `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, closed_at, ended_at, arrived_at, started_at)
			values ('2026-000007', 1, 2, 'closed', 1, 1, 'merged', now(), now(), now(), now())`,
		"merged with subject": `insert into tickets (protocol, sector_id, contact_id, status, assignee_id, closed_by_id, closure_type, merged_into_ticket_id, closed_at, ended_at, arrived_at, started_at, subject, resolution)
			values ('2026-000007', 1, 2, 'closed', 1, 1, 'merged', 3, now(), now(), now(), now(), 'A', 'B')`,
		"target without merged": `update tickets set merged_into_ticket_id = 3 where protocol = '2026-000001'`,
		"merged into itself":    `update tickets set merged_into_ticket_id = id where protocol = '2026-000006'`,
		"pending audit without reason": `insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, changes)
			values (3, 'ticket', 3, 'ticket_pending', 1, '{}')`,
	} {
		if _, err := db.ExecContext(ctx, stmt); err == nil {
			t.Fatalf("%s: accepted", name)
		}
	}

	// Com pendente ou mesclado, a volta é recusada; depois de removidos, desfaz tudo.
	if _, err := p.DownTo(ctx, 34); err == nil {
		t.Fatal("down with pending tickets: accepted")
	}
	if _, err := db.ExecContext(ctx, `delete from tickets where protocol in ('2026-000004', '2026-000005', '2026-000006');
		update tickets set status = 'in_progress', assignee_id = 1, pending_reason = null, pending_by_id = null, pending_at = null
		where protocol = '2026-000003'`); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&before); err != nil {
		t.Fatal(err)
	}
	if _, err := p.DownTo(ctx, 34); err != nil {
		t.Fatalf("down to 34: %v", err)
	}
	if err := db.QueryRowContext(ctx, snapshot).Scan(&after); err != nil {
		t.Fatal(err)
	}
	if before != after {
		t.Fatalf("tickets changed by down:\nbefore %s\nafter  %s", before, after)
	}
	if _, err := p.UpTo(ctx, 36); err != nil {
		t.Fatalf("up again: %v", err)
	}
}

// A migração 37 cria assignee_read_at e marca a leitura dos chamados em
// atendimento com o instante da migração, que começam sem não lidas. A fila
// continua sem leitura.
func TestAssigneeReadStartsWithoutUnread(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 36); err != nil {
		t.Fatalf("up to 36: %v", err)
	}
	if _, err := db.ExecContext(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow');
		insert into contacts (name, registered) values ('Maria', false), ('João', false);
		insert into users (name, nickname, email, password_hash, role, sector_id) values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', 1);
		insert into tickets (protocol, sector_id, contact_id, status, assignee_id, arrived_at, started_at, assigned_at)
		values ('2026-000001', 1, 1, 'in_progress', 1, now(), now(), now());
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ('2026-000002', 1, 2, 'queued', now(), now());`); err != nil {
		t.Fatalf("seed: %v", err)
	}

	start := time.Now()
	if _, err := p.UpTo(ctx, 37); err != nil {
		t.Fatalf("up to 37: %v", err)
	}

	var inProgress, queued *time.Time
	if err := db.QueryRowContext(ctx, `
		select assignee_read_at from tickets where protocol = '2026-000001'`).Scan(&inProgress); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(ctx, `
		select assignee_read_at from tickets where protocol = '2026-000002'`).Scan(&queued); err != nil {
		t.Fatal(err)
	}
	if inProgress == nil || inProgress.Before(start.Truncate(time.Second)) {
		t.Fatalf("reading of the ticket in progress = %v, migration at %v", inProgress, start)
	}
	if queued != nil {
		t.Fatalf("reading of the queued ticket = %v", queued)
	}
}

// A migração 38 faz o horário de gravação da mensagem ser o do insert
// (clock_timestamp()), não o do início da transação, para a comparação com a
// leitura do responsável não esconder uma mensagem gravada por uma transação
// que já estava aberta. O down volta ao padrão anterior.
func TestMessageCreatedAtUsesTheInstantOfTheInsert(t *testing.T) {
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
	if _, err := p.UpTo(ctx, 38); err != nil {
		t.Fatalf("up to 38: %v", err)
	}

	defaultOfCreatedAt := func() string {
		var def string
		if err := db.QueryRowContext(ctx, `
			select column_default from information_schema.columns
			where table_schema = 'public' and table_name = 'messages' and column_name = 'created_at'`).Scan(&def); err != nil {
			t.Fatal(err)
		}
		return def
	}
	if got := defaultOfCreatedAt(); got != "clock_timestamp()" {
		t.Fatalf("default of messages.created_at = %q", got)
	}

	if _, err := p.DownTo(ctx, 37); err != nil {
		t.Fatalf("down to 37: %v", err)
	}
	if got := defaultOfCreatedAt(); got != "now()" {
		t.Fatalf("default of messages.created_at after down = %q", got)
	}
}
