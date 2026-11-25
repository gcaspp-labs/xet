-- +goose Up
-- As regras que as consultas do Dashboard repetem ficam definidas aqui (#452):
-- o início do atendimento (o telefone usa o início da ligação; os outros
-- canais, a atribuição) e o desconto do tempo pendente. Só definição: nenhum
-- dado muda. docs/data-model.md.

-- +goose StatementBegin
create function ticket_handling_start(p_channel ticket_channel, p_started_at timestamptz, p_assigned_at timestamptz)
returns timestamptz
language sql immutable parallel safe
as $$
    select case when p_channel = 'phone' then p_started_at else p_assigned_at end
$$;
-- +goose StatementEnd

-- Lê a auditoria do chamado uma vez e soma os períodos pendentes: cada
-- ticket_pending termina na próxima retomada por id (ticket_resumed,
-- ticket_resumed_by_merge ou ticket_closed_by_merge). A mesclagem de um
-- chamado encerrado (#341) não tem retomada e termina quando o chamado
-- mesclado foi assumido, que pode ser antes do pendente (o desconto é zero
-- então, nunca negativo).
-- +goose StatementBegin
create function ticket_pending_seconds(p_ticket_id bigint)
returns double precision
language sql stable
as $$
    select coalesce(sum(greatest(extract(epoch from next_resume - created_at), 0)), 0)::float8
    from (
        select a.created_at,
               a.action = 'ticket_pending' as is_pending,
               (array_agg(
                   case
                       when a.action = 'ticket_closed_by_merge'
                           then coalesce(merged.assigned_at, a.created_at)
                       when a.action in ('ticket_resumed', 'ticket_resumed_by_merge')
                           then a.created_at
                   end)
                   filter (where a.action <> 'ticket_pending')
                   over (order by a.id rows between 1 following and unbounded following))[1] as next_resume
        from audit_logs a
        left join tickets merged on a.action = 'ticket_closed_by_merge'
            and merged.id = (a.changes -> 'merged_ticket_id' ->> 'to')::bigint
        where a.ticket_id = p_ticket_id
          and a.action in ('ticket_pending', 'ticket_resumed', 'ticket_resumed_by_merge', 'ticket_closed_by_merge')
    ) actions
    where is_pending
$$;
-- +goose StatementEnd

-- +goose Down
drop function ticket_pending_seconds(bigint);
drop function ticket_handling_start(ticket_channel, timestamptz, timestamptz);
