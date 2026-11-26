package db_test

import (
	"errors"
	"strconv"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/gcaspp-labs/xet/backend/internal/db"
	"github.com/gcaspp-labs/xet/backend/internal/testdb"
)

// launchBase traz os cadastros mínimos para um chamado encerrado.
type launchBase struct {
	municipality int64
	sector       int64
	user         int64
	organization int64
}

func newLaunchBase(t *testing.T) (*pgxpool.Pool, *db.Queries, launchBase) {
	t.Helper()
	pool := testdb.New(t)
	ctx := t.Context()
	var b launchBase
	if err := pool.QueryRow(ctx, `select min(id) from municipalities`).Scan(&b.municipality); err != nil {
		t.Fatalf("seed municipality: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into sectors (name, provider) values ('Contabilidade', 'whatsmeow') returning id`).Scan(&b.sector); err != nil {
		t.Fatalf("seed sector: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into organizations (name, municipality_id) values ('Prefeitura', $1) returning id`,
		b.municipality).Scan(&b.organization); err != nil {
		t.Fatalf("seed organization: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		insert into users (name, nickname, email, password_hash, role, sector_id)
		values ('Ana', 'Ana', 'ana@exemplo.com', 'x', 'agent', $1) returning id`,
		b.sector).Scan(&b.user); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return pool, db.New(pool), b
}

func newContact(t *testing.T, pool *pgxpool.Pool, b launchBase, name, phone string) int64 {
	t.Helper()
	var id int64
	if err := pool.QueryRow(t.Context(), `
		insert into contacts (name, registered, phone, organization_id) values ($1, true, $2, $3) returning id`,
		name, phone, b.organization).Scan(&id); err != nil {
		t.Fatalf("seed contact: %v", err)
	}
	return id
}

// newClosedTicket cria um chamado encerrado: resolved (whatsapp ou phone),
// cancelled, transferred ou merged. closedAt é o horário real do encerramento.
func newClosedTicket(t *testing.T, pool *pgxpool.Pool, b launchBase, protocol string, contactID int64, closureType string, closedAt time.Time, mergedInto *int64, channel string) int64 {
	t.Helper()
	var subject, resolution *string
	if closureType == "resolved" {
		subject, resolution = ptr("Senha"), ptr("Redefinida")
	}
	var id int64
	if err := pool.QueryRow(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id,
			closed_by_id, closure_type, merged_into_ticket_id, closed_at, ended_at, arrived_at, started_at,
			subject, resolution, channel)
		values ($1, $2, $3, $4, 'closed', $5, $5, $6::closure_type, $7, $8, $8, $8, $8, $9, $10, $11)
		returning id`,
		protocol, b.sector, contactID, b.organization, b.user, closureType, mergedInto, closedAt, subject, resolution, channel).Scan(&id); err != nil {
		t.Fatalf("seed closed ticket %s: %v", protocol, err)
	}
	return id
}

func newQueuedTicket(t *testing.T, pool *pgxpool.Pool, b launchBase, protocol string, contactID int64) int64 {
	t.Helper()
	var id int64
	if err := pool.QueryRow(t.Context(), `
		insert into tickets (protocol, sector_id, contact_id, status, arrived_at, started_at)
		values ($1, $2, $3, 'queued', now(), now()) returning id`,
		protocol, b.sector, contactID).Scan(&id); err != nil {
		t.Fatalf("seed queued ticket %s: %v", protocol, err)
	}
	return id
}

func wantSQLState(t *testing.T, err error, code string) {
	t.Helper()
	var pgErr *pgconn.PgError
	if !errors.As(err, &pgErr) || pgErr.Code != code {
		t.Fatalf("err = %v, want SQLSTATE %s", err, code)
	}
}

func ptr[T any](v T) *T { return &v }

// Um lançamento por chamado, cada situação com os seus campos, e a reserva
// sempre com o par claimed_at/claim_id.
func TestLegacyLaunchConstraints(t *testing.T) {
	t.Parallel()
	pool, q, b := newLaunchBase(t)
	ctx := t.Context()
	contact := newContact(t, pool, b, "Maria", "5511999990000")

	tickets := make([]int64, 6)
	for i := range tickets {
		protocol := "2026-00001" + string(rune('0'+i))
		tickets[i] = newClosedTicket(t, pool, b, protocol, contact, "resolved", time.Now(), nil, "whatsapp")
		if _, err := q.EnqueueLegacyLaunch(ctx, tickets[i]); err != nil {
			t.Fatalf("enqueue: %v", err)
		}
	}

	// Um por chamado: a chave primária recusa o segundo.
	_, err := q.EnqueueLegacyLaunch(ctx, tickets[0])
	if err != nil {
		t.Fatalf("enqueue on conflict: %v", err)
	}
	if err := pool.QueryRow(ctx, `insert into legacy_launches (ticket_id) values ($1) returning ticket_id`, tickets[0]).Scan(new(int64)); err == nil {
		t.Fatal("second launch of the same ticket: accepted")
	} else {
		wantSQLState(t, err, "23505")
	}

	setStatus := func(ticketID int64, set string, args ...any) error {
		_, err := pool.Exec(ctx, `update legacy_launches set `+set+` where ticket_id = $1`, append([]any{ticketID}, args...)...)
		return err
	}

	cases := map[string]struct {
		ticketID int64
		stmt     string
		args     []any
		code     string
	}{
		"launched without the number": {
			tickets[1], `status = 'launched', launched_at = now()`, nil, "23514",
		},
		"launched without the date": {
			tickets[1], `status = 'launched', legacy_number = '900001'`, nil, "23514",
		},
		"launched with an error": {
			tickets[1], `status = 'launched', legacy_number = '900001', launched_at = now(),
				error_kind = 'unavailable', error_reason = 'Legado fora do ar.'`, nil, "23514",
		},
		"failed without the kind": {
			tickets[2], `status = 'failed', error_reason = 'Legado fora do ar.'`, nil, "23514",
		},
		"failed without the reason": {
			tickets[2], `status = 'failed', error_kind = 'unavailable'`, nil, "23514",
		},
		"failed with a blank reason": {
			tickets[2], `status = 'failed', error_kind = 'unavailable', error_reason = '  '`, nil, "23514",
		},
		"pending with an error": {
			tickets[3], `error_kind = 'unavailable', error_reason = 'Legado fora do ar.'`, nil, "23514",
		},
		"claim without the claim_id": {
			tickets[3], `claimed_at = now()`, nil, "23514",
		},
		"negative attempts": {
			tickets[3], `attempts = -1`, nil, "23514",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			wantSQLState(t, setStatus(tc.ticketID, tc.stmt, tc.args...), tc.code)
		})
	}

	// Lançado de verdade: número e data; o mesmo número não se repete.
	if err := setStatus(tickets[1], `status = 'launched', legacy_number = '900001', launched_at = now(),
		error_kind = null, error_reason = null`); err != nil {
		t.Fatalf("launched: %v", err)
	}
	wantSQLState(t, setStatus(tickets[2], `status = 'launched', legacy_number = '900001', launched_at = now()`), "23505")

	// A reserva é sempre o par.
	if err := setStatus(tickets[3], `claimed_at = now(), claim_id = gen_random_uuid()`); err != nil {
		t.Fatalf("claim: %v", err)
	}
	if err := setStatus(tickets[3], `claim_id = null`); err == nil {
		t.Fatal("claimed_at without claim_id: accepted")
	} else {
		wantSQLState(t, err, "23514")
	}

	// Configuração: linha única, contador não negativo e pausa sempre com motivo.
	if _, err := pool.Exec(ctx, `insert into legacy_launch_settings (id) values (1)`); err == nil {
		t.Fatal("a second settings row with id 1: accepted")
	}
	if _, err := pool.Exec(ctx, `insert into legacy_launch_settings (id) values (2)`); err == nil {
		t.Fatal("a second settings row with id 2: accepted")
	} else {
		wantSQLState(t, err, "23514")
	}
	settings := func(set string) error {
		_, err := pool.Exec(ctx, `update legacy_launch_settings set `+set+` where id = 1`)
		return err
	}
	wantSQLState(t, settings(`paused_at = now()`), "23514")
	wantSQLState(t, settings(`paused_at = now(), paused_reason = '  '`), "23514")
	wantSQLState(t, settings(`consecutive_failures = -1`), "23514")
	if err := settings(`paused_at = now(), paused_reason = 'Login recusado.'`); err != nil {
		t.Fatalf("pause with a reason: %v", err)
	}

	// O de-para recusa texto em branco nas três colunas.
	for name, stmt := range map[string]string{
		"legacy_code":   `update organizations set legacy_code = '  ' where id = ` + strconv.FormatInt(b.organization, 10),
		"legacy_sector": `update sectors set legacy_sector = '  ' where id = ` + strconv.FormatInt(b.sector, 10),
		"legacy_user":   `update users set legacy_user = '  ' where id = ` + strconv.FormatInt(b.user, 10),
	} {
		if _, err := pool.Exec(ctx, stmt); err == nil {
			t.Fatalf("blank %s: accepted", name)
		} else {
			wantSQLState(t, err, "23514")
		}
	}
}

// Dois for update skip locked ao mesmo tempo pegam lançamentos diferentes: a
// linha travada por uma transação aberta é pulada pela outra.
func TestLegacyLaunchClaimSkipsLockedRows(t *testing.T) {
	t.Parallel()
	pool, q, b := newLaunchBase(t)
	ctx := t.Context()
	contact := newContact(t, pool, b, "Maria", "5511999990000")
	for i, protocol := range []string{"2026-000010", "2026-000011", "2026-000012"} {
		ticket := newClosedTicket(t, pool, b, protocol, contact, "resolved", time.Now(), nil, "whatsapp")
		if _, err := q.EnqueueLegacyLaunch(ctx, ticket); err != nil {
			t.Fatalf("enqueue %d: %v", i, err)
		}
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tx.Rollback(ctx) }()

	first, err := db.New(pool).WithTx(tx).ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatalf("first claim: %v", err)
	}
	if !first.ClaimID.Valid || first.ClaimedAt == nil || first.Attempts != 1 {
		t.Fatalf("first claim incomplete: %+v", first)
	}
	if first.NextAttemptAt != nil {
		t.Fatalf("first claim kept next_attempt_at: %v", first.NextAttemptAt)
	}

	// Com a linha de first travada, a segunda reserva pega outra.
	second, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatalf("second claim: %v", err)
	}
	if second.TicketID == first.TicketID {
		t.Fatalf("both claims took ticket %d", first.TicketID)
	}

	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}

	third, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatalf("third claim: %v", err)
	}
	seen := map[int64]bool{first.TicketID: true, second.TicketID: true, third.TicketID: true}
	if len(seen) != 3 {
		t.Fatalf("claims took %v, want three different tickets", seen)
	}

	if _, err := q.ClaimLegacyLaunch(ctx); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("claim with an empty queue = %v, want no rows", err)
	}
}

// A reserva vencida vira resultado desconhecido; a retomada avisa quem chamou;
// e o resultado só é gravado com o claim_id da reserva.
func TestLegacyLaunchStaleClaimAndResult(t *testing.T) {
	t.Parallel()
	pool, q, b := newLaunchBase(t)
	ctx := t.Context()
	contact := newContact(t, pool, b, "Maria", "5511999990000")
	ticket := newClosedTicket(t, pool, b, "2026-000020", contact, "resolved", time.Now(), nil, "whatsapp")
	if _, err := q.EnqueueLegacyLaunch(ctx, ticket); err != nil {
		t.Fatal(err)
	}
	claimed, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if claimed.TicketID != ticket || !claimed.ClaimID.Valid {
		t.Fatalf("claim = %+v, want ticket %d", claimed, ticket)
	}

	// Passaram-se mais de 10 minutos sem o robô responder.
	if _, err := pool.Exec(ctx, `
		update legacy_launches set claimed_at = now() - interval '11 minutes' where ticket_id = $1`, ticket); err != nil {
		t.Fatal(err)
	}
	released, err := q.ReleaseStaleLegacyLaunchClaim(ctx)
	if err != nil {
		t.Fatalf("release: %v", err)
	}
	if released != 1 {
		t.Fatalf("released = %d, want 1", released)
	}
	got, err := q.GetLegacyLaunch(ctx, ticket)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != db.LegacyLaunchStatusFailed || !got.ErrorKind.Valid ||
		got.ErrorKind.LegacyLaunchError != db.LegacyLaunchErrorUnknownResult {
		t.Fatalf("stale claim after release = %+v", got)
	}
	if got.ErrorReason == nil || *got.ErrorReason == "" {
		t.Fatal("stale claim released without a reason")
	}
	if got.ClaimID.Valid || got.ClaimedAt != nil {
		t.Fatalf("stale claim kept the reservation: %+v", got)
	}
	if got.NextAttemptAt == nil {
		t.Fatal("stale claim released without a next attempt")
	}
	if released, err := q.ReleaseStaleLegacyLaunchClaim(ctx); err != nil || released != 0 {
		t.Fatalf("release without stale claims = %d, %v", released, err)
	}

	// Uma reserva antiga pode ser retomada, e o chamador fica sabendo.
	if _, err := pool.Exec(ctx, `
		update legacy_launches set claimed_at = now() - interval '11 minutes', claim_id = gen_random_uuid()
		where ticket_id = $1`, ticket); err != nil {
		t.Fatal(err)
	}
	reclaimed, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatalf("reclaim: %v", err)
	}
	if reclaimed.StaleClaim == nil || !*reclaimed.StaleClaim {
		t.Fatalf("stale claim flag = %v, want true", reclaimed.StaleClaim)
	}
	if reclaimed.Attempts != 2 {
		t.Fatalf("attempts after reclaim = %d, want 2", reclaimed.Attempts)
	}

	// O resultado com outro claim_id não grava nada.
	wrong := pgtype.UUID{Bytes: [16]byte{1}, Valid: true}
	_, err = q.RecordLegacyLaunchFailed(ctx, db.RecordLegacyLaunchFailedParams{
		TicketID:    ticket,
		ClaimID:     wrong,
		ErrorKind:   db.NullLegacyLaunchError{LegacyLaunchError: db.LegacyLaunchErrorUnavailable, Valid: true},
		ErrorReason: ptr("Legado fora do ar."),
	})
	if !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("result with a wrong claim_id = %v, want no rows", err)
	}
	untouched, err := q.GetLegacyLaunch(ctx, ticket)
	if err != nil {
		t.Fatal(err)
	}
	if untouched.ErrorKind.LegacyLaunchError != db.LegacyLaunchErrorUnknownResult ||
		untouched.Attempts != 2 || !untouched.ClaimID.Valid {
		t.Fatalf("wrong claim_id changed the launch: %+v", untouched)
	}

	// Com o claim_id certo, o erro grava e solta a reserva.
	next := time.Now().Add(time.Minute)
	failed, err := q.RecordLegacyLaunchFailed(ctx, db.RecordLegacyLaunchFailedParams{
		TicketID:      ticket,
		ClaimID:       reclaimed.ClaimID,
		ErrorKind:     db.NullLegacyLaunchError{LegacyLaunchError: db.LegacyLaunchErrorUnavailable, Valid: true},
		ErrorReason:   ptr("Legado fora do ar."),
		NextAttemptAt: &next,
	})
	if err != nil {
		t.Fatalf("record failed: %v", err)
	}
	if failed.Status != db.LegacyLaunchStatusFailed ||
		failed.ErrorKind.LegacyLaunchError != db.LegacyLaunchErrorUnavailable ||
		failed.ClaimID.Valid || failed.NextAttemptAt == nil {
		t.Fatalf("failed launch = %+v", failed)
	}

	// O sucesso grava o número e limpa erro e reserva.
	secondTicket := newClosedTicket(t, pool, b, "2026-000021", contact, "resolved", time.Now(), nil, "whatsapp")
	if _, err := q.EnqueueLegacyLaunch(ctx, secondTicket); err != nil {
		t.Fatal(err)
	}
	successClaim, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatalf("claim for the success: %v", err)
	}
	if successClaim.TicketID != secondTicket {
		t.Fatalf("claimed ticket %d, want %d", successClaim.TicketID, secondTicket)
	}
	number := "2026-000123"
	launchedAt := time.Now()
	launched, err := q.RecordLegacyLaunchLaunched(ctx, db.RecordLegacyLaunchLaunchedParams{
		TicketID:     secondTicket,
		ClaimID:      successClaim.ClaimID,
		LegacyNumber: &number,
		LaunchedAt:   &launchedAt,
	})
	if err != nil {
		t.Fatalf("record launched: %v", err)
	}
	if launched.Status != db.LegacyLaunchStatusLaunched || launched.LegacyNumber == nil ||
		*launched.LegacyNumber != number || launched.ErrorKind.Valid || launched.ErrorReason != nil ||
		launched.ClaimID.Valid || launched.NextAttemptAt != nil {
		t.Fatalf("launched = %+v", launched)
	}
}

// A fila, o Tentar de novo e as leituras da tela.
func TestLegacyLaunchQueueAndReads(t *testing.T) {
	t.Parallel()
	pool, q, b := newLaunchBase(t)
	ctx := t.Context()
	contact := newContact(t, pool, b, "Maria", "5511999990000")

	first := newClosedTicket(t, pool, b, "2026-000030", contact, "resolved", time.Now(), nil, "whatsapp")
	second := newClosedTicket(t, pool, b, "2026-000031", contact, "resolved", time.Now(), nil, "whatsapp")
	if inserted, err := q.EnqueueLegacyLaunch(ctx, first); err != nil || inserted != 1 {
		t.Fatalf("enqueue = %d, %v", inserted, err)
	}
	if inserted, err := q.EnqueueLegacyLaunch(ctx, first); err != nil || inserted != 0 {
		t.Fatalf("enqueue again = %d, %v", inserted, err)
	}
	if _, err := q.EnqueueLegacyLaunch(ctx, second); err != nil {
		t.Fatal(err)
	}

	claimed, err := q.ClaimLegacyLaunch(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := q.RecordLegacyLaunchFailed(ctx, db.RecordLegacyLaunchFailedParams{
		TicketID:    claimed.TicketID,
		ClaimID:     claimed.ClaimID,
		ErrorKind:   db.NullLegacyLaunchError{LegacyLaunchError: db.LegacyLaunchErrorMappingMissing, Valid: true},
		ErrorReason: ptr("Órgão sem código no legado."),
	}); err != nil {
		t.Fatal(err)
	}

	counts, err := q.CountLegacyLaunchesByStatus(ctx)
	if err != nil {
		t.Fatal(err)
	}
	byStatus := map[db.LegacyLaunchStatus]int64{}
	for _, c := range counts {
		byStatus[c.Status] = c.Total
	}
	if byStatus[db.LegacyLaunchStatusPending] != 1 || byStatus[db.LegacyLaunchStatusFailed] != 1 || byStatus[db.LegacyLaunchStatusLaunched] != 0 {
		t.Fatalf("counts by status = %v", byStatus)
	}

	failed, err := q.ListFailedLegacyLaunches(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(failed) != 1 || failed[0].TicketID != claimed.TicketID {
		t.Fatalf("failed launches = %+v", failed)
	}
	if failed[0].Protocol == "" || failed[0].ContactName != "Maria" || failed[0].OrganizationName == nil {
		t.Fatalf("failed launch without the screen data: %+v", failed[0])
	}

	// Tentar de novo devolve para a fila, zerando tentativas e erro.
	if retried, err := q.RetryLegacyLaunch(ctx, claimed.TicketID); err != nil || retried != 1 {
		t.Fatalf("retry = %d, %v", retried, err)
	}
	again, err := q.GetLegacyLaunch(ctx, claimed.TicketID)
	if err != nil {
		t.Fatal(err)
	}
	if again.Status != db.LegacyLaunchStatusPending || again.Attempts != 0 ||
		again.ErrorKind.Valid || again.ErrorReason != nil || again.NextAttemptAt == nil || again.ClaimID.Valid {
		t.Fatalf("retried launch = %+v", again)
	}
	if retried, err := q.RetryLegacyLaunch(ctx, claimed.TicketID); err != nil || retried != 0 {
		t.Fatalf("retry of a pending launch = %d, %v", retried, err)
	}
}

// O lote pega só os encerrados normalmente a partir da data, ainda sem lançamento.
func TestListLaunchableTicketsSince(t *testing.T) {
	t.Parallel()
	pool, q, b := newLaunchBase(t)
	ctx := t.Context()
	maria := newContact(t, pool, b, "Maria", "5511999990000")
	joão := newContact(t, pool, b, "João", "5511988880000")
	recent := time.Now().Add(-time.Hour)
	old := time.Now().Add(-10 * 24 * time.Hour)

	recentWhatsApp := newClosedTicket(t, pool, b, "2026-000040", maria, "resolved", recent, nil, "whatsapp")
	recentPhone := newClosedTicket(t, pool, b, "2026-000041", maria, "resolved", recent, nil, "phone")
	oldResolved := newClosedTicket(t, pool, b, "2026-000042", maria, "resolved", old, nil, "whatsapp")
	cancelled := newClosedTicket(t, pool, b, "2026-000043", maria, "cancelled", recent, nil, "whatsapp")
	transferred := newClosedTicket(t, pool, b, "2026-000044", maria, "transferred", recent, nil, "whatsapp")
	mergedTarget := newQueuedTicket(t, pool, b, "2026-000045", joão)
	merged := newClosedTicket(t, pool, b, "2026-000046", maria, "merged", recent, &mergedTarget, "whatsapp")
	withLaunch := newClosedTicket(t, pool, b, "2026-000047", maria, "resolved", recent, nil, "whatsapp")
	if _, err := q.EnqueueLegacyLaunch(ctx, withLaunch); err != nil {
		t.Fatal(err)
	}

	got, err := q.ListLaunchableTicketsSince(ctx, ptr(time.Now().Add(-24*time.Hour)))
	if err != nil {
		t.Fatal(err)
	}
	ids := map[int64]bool{}
	for _, row := range got {
		ids[row.ID] = true
	}
	want := map[int64]bool{recentWhatsApp: true, recentPhone: true}
	if len(ids) != len(want) {
		t.Fatalf("launchable tickets = %v, want %v", ids, want)
	}
	for id := range want {
		if !ids[id] {
			t.Fatalf("launchable tickets = %v, missing %d", ids, id)
		}
	}
	for name, id := range map[string]int64{
		"old resolved": oldResolved, "cancelled": cancelled, "transferred": transferred,
		"merged": merged, "with launch": withLaunch,
	} {
		if ids[id] {
			t.Fatalf("%s ticket %d in the batch", name, id)
		}
	}
}

func TestLegacyLaunchSettings(t *testing.T) {
	t.Parallel()
	_, q, _ := newLaunchBase(t)
	ctx := t.Context()

	settings, err := q.GetLegacyLaunchSettings(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if settings.ID != 1 || settings.AutomaticEnabled || settings.ConsecutiveFailures != 0 ||
		settings.PausedAt != nil || settings.PausedReason != nil {
		t.Fatalf("default settings = %+v", settings)
	}

	pausedAt := time.Now()
	updated, err := q.UpdateLegacyLaunchSettings(ctx, db.UpdateLegacyLaunchSettingsParams{
		AutomaticEnabled:    true,
		ConsecutiveFailures: 3,
		PausedAt:            &pausedAt,
		PausedReason:        ptr("Login recusado."),
	})
	if err != nil {
		t.Fatal(err)
	}
	if !updated.AutomaticEnabled || updated.ConsecutiveFailures != 3 || updated.PausedAt == nil ||
		updated.PausedReason == nil || *updated.PausedReason != "Login recusado." {
		t.Fatalf("updated settings = %+v", updated)
	}

	reset, err := q.ResetLegacyLaunchPause(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if !reset.AutomaticEnabled || reset.ConsecutiveFailures != 0 || reset.PausedAt != nil || reset.PausedReason != nil {
		t.Fatalf("reset settings = %+v", reset)
	}
}
