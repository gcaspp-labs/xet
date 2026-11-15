-- Histórico de Atendimentos: só chamados encerrados (status = 'closed'), na ordem,
-- com a busca e os filtros no servidor. A data é o momento real do encerramento
-- (closed_at); o responsável é o assignee_id; o destino de um transferido é o
-- setor do chamado que nasceu dele (previous_ticket_id é único).
-- name: CountClosedTicketsPage :one
select count(*)
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
left join tickets n on n.previous_ticket_id = t.id
left join sectors ns on ns.id = n.sector_id
where t.status = 'closed'
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
  and (sqlc.narg(module)::text is null
      or exists (select 1 from ticket_modules tm join modules md on md.id = tm.module_id
          where tm.ticket_id = t.id
            and strpos(lower(unaccent(md.name)), lower(unaccent(sqlc.narg(module)::text))) > 0))
  and (sqlc.narg(closed_from)::timestamptz is null or t.closed_at >= sqlc.narg(closed_from)::timestamptz)
  and (sqlc.narg(closed_until)::timestamptz is null or t.closed_at < sqlc.narg(closed_until)::timestamptz)
  and (sqlc.narg(subject)::text is null
      or strpos(lower(unaccent(coalesce(t.subject, ''))), lower(unaccent(sqlc.narg(subject)::text))) > 0)
  and (sqlc.narg(search)::text is null
      or strpos(lower(unaccent(t.protocol)), lower(unaccent(sqlc.narg(search)::text))) > 0
      or strpos(lower(unaccent(c.name)), lower(unaccent(sqlc.narg(search)::text))) > 0
      or strpos(lower(unaccent(coalesce(o.name, ''))), lower(unaccent(sqlc.narg(search)::text))) > 0
      or (sqlc.narg(search_digits)::text is not null and strpos(coalesce(c.phone, ''), sqlc.narg(search_digits)::text) > 0));

-- name: ListClosedTicketsPage :many
select
    t.id, t.protocol, t.closure_type, t.closed_at, t.subject,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    t.sector_id, s.name as sector_name,
    t.assignee_id, u.name as assignee_name,
    ns.id as transferred_sector_id, ns.name as transferred_sector_name,
    coalesce((select array_agg(md.name order by lower(md.name), md.id)
        from ticket_modules tm join modules md on md.id = tm.module_id where tm.ticket_id = t.id), '{}')::text[] as module_names
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
left join tickets n on n.previous_ticket_id = t.id
left join sectors ns on ns.id = n.sector_id
where t.status = 'closed'
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
  and (sqlc.narg(module)::text is null
      or exists (select 1 from ticket_modules tm join modules md on md.id = tm.module_id
          where tm.ticket_id = t.id
            and strpos(lower(unaccent(md.name)), lower(unaccent(sqlc.narg(module)::text))) > 0))
  and (sqlc.narg(closed_from)::timestamptz is null or t.closed_at >= sqlc.narg(closed_from)::timestamptz)
  and (sqlc.narg(closed_until)::timestamptz is null or t.closed_at < sqlc.narg(closed_until)::timestamptz)
  and (sqlc.narg(subject)::text is null
      or strpos(lower(unaccent(coalesce(t.subject, ''))), lower(unaccent(sqlc.narg(subject)::text))) > 0)
  and (sqlc.narg(search)::text is null
      or strpos(lower(unaccent(t.protocol)), lower(unaccent(sqlc.narg(search)::text))) > 0
      or strpos(lower(unaccent(c.name)), lower(unaccent(sqlc.narg(search)::text))) > 0
      or strpos(lower(unaccent(coalesce(o.name, ''))), lower(unaccent(sqlc.narg(search)::text))) > 0
      or (sqlc.narg(search_digits)::text is not null and strpos(coalesce(c.phone, ''), sqlc.narg(search_digits)::text) > 0))
order by
    case when @sort::text = 'protocol' and @direction::text = 'asc' then lower(unaccent(t.protocol)) end asc nulls last,
    case when @sort::text = 'protocol' and @direction::text = 'desc' then lower(unaccent(t.protocol)) end desc nulls last,
    case when @sort::text = 'date' and @direction::text = 'asc' then t.closed_at end asc nulls last,
    case when @sort::text = 'date' and @direction::text = 'desc' then t.closed_at end desc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'asc' then lower(unaccent(c.name)) end asc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'desc' then lower(unaccent(c.name)) end desc nulls last,
    case when @sort::text = 'organization' and @direction::text = 'asc' then lower(unaccent(o.name)) end asc nulls last,
    case when @sort::text = 'organization' and @direction::text = 'desc' then lower(unaccent(o.name)) end desc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'asc' then lower(unaccent(s.name)) end asc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'desc' then lower(unaccent(s.name)) end desc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'asc' then lower(unaccent(u.name)) end asc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'desc' then lower(unaccent(u.name)) end desc nulls last,
    case when @sort::text = 'subject' and @direction::text = 'asc' then lower(unaccent(t.subject)) end asc nulls last,
    case when @sort::text = 'subject' and @direction::text = 'desc' then lower(unaccent(t.subject)) end desc nulls last,
    case when @sort::text = 'situation' and @direction::text = 'asc' then case t.closure_type when 'cancelled' then 'cancelado' when 'transferred' then 'transferido' else 'encerrado' end end asc nulls last,
    case when @sort::text = 'situation' and @direction::text = 'desc' then case t.closure_type when 'cancelled' then 'cancelado' when 'transferred' then 'transferido' else 'encerrado' end end desc nulls last,
    case when @direction::text = 'asc' then t.id end asc,
    case when @direction::text = 'desc' then t.id end desc
limit 20 offset @page_offset;

-- name: ListClosedTicketSubjects :many
-- Sugestões do filtro de assunto: assuntos distintos dos chamados encerrados.
select distinct t.subject::text as subject
from tickets t
where t.status = 'closed' and t.subject is not null and t.subject <> ''
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(search)::text is null
      or strpos(lower(unaccent(t.subject)), lower(unaccent(sqlc.narg(search)::text))) > 0)
order by 1
limit 10;
