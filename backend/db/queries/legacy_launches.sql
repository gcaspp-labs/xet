-- name: EnqueueLegacyLaunch :execrows
-- Põe o chamado na fila do legado; se ele já tem lançamento, nada muda e a
-- consulta devolve 0. O next_attempt_at nasce agora, para o robô poder pegar.
insert into legacy_launches (ticket_id, next_attempt_at)
values (@ticket_id, now())
on conflict (ticket_id) do nothing;

-- name: ClaimLegacyLaunch :one
-- Reserva um lançamento por vez: a lançar na hora da próxima tentativa, com
-- erro passageiro (legado indisponível, resultado desconhecido) cuja próxima
-- tentativa chegou, ou com reserva vencida (sem resposta do robô por
-- stale_after, o prazo único que o Go passa), mesmo que a reserva tenha zerado
-- next_attempt_at. O for update skip locked faz dois robôs pegarem lançamentos
-- diferentes. A reserva conta a tentativa e zera next_attempt_at; stale_claim
-- avisa quem chamou que o robô anterior não respondeu.
with candidate as (
    select l.ticket_id,
           l.claimed_at is not null and l.claimed_at < now() - sqlc.arg('stale_after')::interval as stale_claim
    from legacy_launches l
    where (l.status = 'pending'
           or (l.status = 'failed' and l.error_kind in ('unavailable', 'unknown_result')))
      and (
          (l.next_attempt_at is not null and l.next_attempt_at <= now())
          or (l.claimed_at is not null and l.claimed_at < now() - sqlc.arg('stale_after')::interval)
      )
    order by coalesce(l.next_attempt_at, l.claimed_at + sqlc.arg('stale_after')::interval), l.ticket_id
    limit 1
    for update skip locked
)
update legacy_launches l
set claimed_at = now(),
    claim_id = gen_random_uuid(),
    attempts = l.attempts + 1,
    next_attempt_at = null
from candidate c
where l.ticket_id = c.ticket_id
returning l.*, c.stale_claim;

-- name: ReleaseStaleLegacyLaunchClaim :execrows
-- Solta a reserva vencida (sem resposta do robô por stale_after, o mesmo prazo
-- da reserva) como resultado desconhecido: a próxima tentativa procura antes de
-- lançar.
update legacy_launches
set status = 'failed',
    error_kind = 'unknown_result',
    error_reason = 'O robô não respondeu; a próxima tentativa procura o lançamento antes de lançar.',
    claimed_at = null,
    claim_id = null,
    next_attempt_at = now()
where claimed_at is not null
  and claimed_at < now() - sqlc.arg('stale_after')::interval;

-- name: RecordLegacyLaunchLaunched :one
-- O legado confirmou: guarda o número e a data e limpa erro e reserva. Só vale
-- com o claim_id da reserva.
update legacy_launches
set status = 'launched',
    legacy_number = @legacy_number,
    launched_at = @launched_at,
    error_kind = null,
    error_reason = null,
    claimed_at = null,
    claim_id = null,
    next_attempt_at = null
where ticket_id = @ticket_id
  and claim_id = @claim_id
returning *;

-- name: RecordLegacyLaunchFailed :one
-- O legado recusou ou não deu para saber: guarda o tipo e o motivo e solta a
-- reserva. next_attempt_at marca a próxima tentativa automática; vazio quando
-- não há mais tentativa possível. Só vale com o claim_id da reserva.
update legacy_launches
set status = 'failed',
    error_kind = @error_kind,
    error_reason = @error_reason,
    claimed_at = null,
    claim_id = null,
    next_attempt_at = sqlc.narg('next_attempt_at')
where ticket_id = @ticket_id
  and claim_id = @claim_id
returning *;

-- name: RetryLegacyLaunch :execrows
-- O Tentar de novo da tela devolve um lançamento com erro para a fila, zerando
-- as tentativas e o erro. Não mexe num lançamento que está sendo tentado agora.
update legacy_launches
set status = 'pending',
    error_kind = null,
    error_reason = null,
    attempts = 0,
    claimed_at = null,
    claim_id = null,
    next_attempt_at = now()
where ticket_id = @ticket_id
  and status = 'failed'
  and claimed_at is null;

-- name: GetLegacyLaunch :one
select * from legacy_launches
where ticket_id = @ticket_id;

-- name: CountLegacyLaunchesByStatus :many
select status, count(*)::bigint as total
from legacy_launches
group by status
order by status;

-- name: ListFailedLegacyLaunches :many
-- A lista de erros da tela de Configurações, por chamado.
select l.*, t.protocol, c.name as contact_name, o.name as organization_name
from legacy_launches l
join tickets t on t.id = l.ticket_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
where l.status = 'failed'
order by l.ticket_id desc;

-- name: ListLaunchableTicketsSince :many
-- Os chamados que o lote pode pegar: encerrados normalmente (inclusive o
-- registro por telefone), a partir da data escolhida, ainda sem lançamento.
-- Cancelados, transferidos e mesclados ficam de fora.
select t.id, t.protocol, t.closed_at
from tickets t
left join legacy_launches l on l.ticket_id = t.id
where t.status = 'closed'
  and t.closure_type = 'resolved'
  and t.closed_at >= @since
  and l.ticket_id is null
order by t.closed_at, t.id;
