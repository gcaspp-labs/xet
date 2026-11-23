-- Numbers of the dashboard (spec.md, Dashboard do atendimento). A ticket came
-- in (it is "received") when it arrived from another sector or from the
-- customer; otherwise the team started it, in the system or on the phone. The
-- first message is the lowest id, the one that opened the ticket: sent_at
-- comes from the clock of the phone. A transferred ticket is received even if
-- the phone is the first to write in it. A phone registration (#316) never
-- arrived from the customer nor from the team: it is born closed, with the
-- times of the call.

-- name: DashboardCurrent :one
-- Tickets open right now, whatever the period.
select
    count(*) filter (where t.status = 'queued') as queued,
    count(*) filter (where t.status = 'in_progress'
        and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))) as in_progress
from tickets t
where t.status in ('queued', 'in_progress')
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id));

-- name: DashboardArrivals :one
-- Tickets that arrived in the period, received or started by the team. The
-- assignee filter is who started the ticket in the system.
select
    count(*) filter (where a.came_in) as received,
    count(*) filter (where not a.came_in
        and (sqlc.narg(assignee_id)::bigint is null or a.created_by_id = sqlc.narg(assignee_id))) as started
from (
    select
        t.created_by_id,
        t.previous_ticket_id is not null or (t.created_by_id is null
            and (select m.origin from messages m where m.ticket_id = t.id order by m.id limit 1) is distinct from 'phone') as came_in
    from tickets t
    where t.arrived_at >= @period_start::timestamptz and t.arrived_at < @period_end::timestamptz
      and t.channel <> 'phone'
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
) a;

-- name: DashboardWait :one
-- Wait of the received tickets assumed in the period. assigned_at keeps the
-- first time, so the time after a return to the queue does not count. The
-- arrival comes from the clock of the sender: when it is after the assignment,
-- the wait is zero. The phone registration has no wait.
select
    count(*) as waited,
    coalesce(sum(greatest(extract(epoch from t.assigned_at - t.arrived_at), 0)), 0)::float8 as wait_seconds
from tickets t
where t.assigned_at >= @period_start::timestamptz and t.assigned_at < @period_end::timestamptz
  and t.channel <> 'phone'
  and (t.previous_ticket_id is not null or (t.created_by_id is null
      and (select m.origin from messages m where m.ticket_id = t.id order by m.id limit 1) is distinct from 'phone'))
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id));

-- name: DashboardClosures :one
-- Tickets closed in the period, by the real closing moment, and the handling
-- time: from the first assignment to the end of the form, which may be edited.
-- An end before the start and the cancelled tickets stay out of the average.
-- The phone registration is born at the start informed of the call and that
-- start may be corrected, so its handling time goes from the start informed now
-- to the end. The start of the phone registration is the current started_at,
-- not assigned_at, which a correction does not touch.
select
    count(*) filter (where c.closure_type = 'resolved') as resolved,
    count(*) filter (where c.closure_type = 'transferred') as transferred,
    count(*) filter (where c.closure_type = 'cancelled') as cancelled,
    count(*) filter (where c.closure_type <> 'cancelled' and c.ended_at >= c.handling_start) as handled,
    coalesce(sum(extract(epoch from c.ended_at - c.handling_start))
        filter (where c.closure_type <> 'cancelled' and c.ended_at >= c.handling_start), 0)::float8 as handling_seconds
from (
    select t.closure_type, t.ended_at,
        case when t.channel = 'phone' then t.started_at else t.assigned_at end as handling_start
    from tickets t
    where t.status = 'closed' and t.closed_at >= @period_start::timestamptz and t.closed_at < @period_end::timestamptz
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
      and (sqlc.narg(channel)::ticket_channel is null or t.channel = sqlc.narg(channel))
      and (sqlc.narg(module_id)::bigint is null
          or exists (select 1 from ticket_modules tm where tm.ticket_id = t.id and tm.module_id = sqlc.narg(module_id)))
) c;

-- name: DashboardByAssignee :many
-- One row per person and sector, with the rules of the numbers above. Only
-- what counts makes a row, so nobody appears with everything at zero. With a
-- module, only the closings that apply to it count. With a channel, the tickets
-- in progress and the started ones do not make a row: the channel does not
-- apply to those numbers, and the closings are the numbers of the channel.
select
    r.sector_id, s.name as sector_name, r.user_id::bigint as user_id, u.name as user_name,
    sum(r.in_progress)::bigint as in_progress,
    sum(r.started)::bigint as started,
    sum(r.resolved)::bigint as resolved,
    sum(r.transferred)::bigint as transferred,
    sum(r.cancelled)::bigint as cancelled,
    sum(r.handled)::bigint as handled,
    sum(r.handling_seconds)::float8 as handling_seconds
from (
    select t.sector_id, t.assignee_id as user_id,
        1 as in_progress, 0 as started, 0 as resolved, 0 as transferred, 0 as cancelled, 0 as handled, 0::float8 as handling_seconds
    from tickets t
    where t.status = 'in_progress' and sqlc.narg(module_id)::bigint is null
      and sqlc.narg(channel)::ticket_channel is null
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
    union all
    select t.sector_id, t.created_by_id,
        0, 1, 0, 0, 0, 0, 0::float8
    from tickets t
    where t.created_by_id is not null and t.channel <> 'phone'
      and sqlc.narg(module_id)::bigint is null and sqlc.narg(channel)::ticket_channel is null
      and t.arrived_at >= @period_start::timestamptz and t.arrived_at < @period_end::timestamptz
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.created_by_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
    union all
    select c.sector_id, c.assignee_id,
        0, 0,
        (c.closure_type = 'resolved')::int,
        (c.closure_type = 'transferred')::int,
        (c.closure_type = 'cancelled')::int,
        case when c.closure_type <> 'cancelled' and c.ended_at >= c.handling_start then 1 else 0 end,
        case when c.closure_type <> 'cancelled' and c.ended_at >= c.handling_start
            then extract(epoch from c.ended_at - c.handling_start)::float8 else 0::float8 end
    from (
        select t.sector_id, t.assignee_id, t.closure_type, t.ended_at,
            case when t.channel = 'phone' then t.started_at else t.assigned_at end as handling_start
        from tickets t
        where t.status = 'closed' and t.closed_at >= @period_start::timestamptz and t.closed_at < @period_end::timestamptz
          and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
          and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
          and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
          and (sqlc.narg(channel)::ticket_channel is null or t.channel = sqlc.narg(channel))
          and (sqlc.narg(module_id)::bigint is null or (t.closure_type <> 'cancelled'
              and exists (select 1 from ticket_modules tm where tm.ticket_id = t.id and tm.module_id = sqlc.narg(module_id))))
    ) c
) r
join sectors s on s.id = r.sector_id
join users u on u.id = r.user_id
group by r.sector_id, s.name, r.user_id, u.name
order by lower(u.name), r.user_id, lower(s.name), r.sector_id;

-- name: ListDashboardAssignees :many
-- Options of the assignee filter of a sector: who belongs to it, active or
-- not, and who has ever been responsible for one of its tickets, including
-- whoever passed the ticket on (audit log).
select u.id, u.name, u.active
from users u
where u.sector_id = @sector_id::bigint
   or u.id in (select t.assignee_id from tickets t where t.sector_id = @sector_id and t.assignee_id is not null)
   or u.id in (select t.created_by_id from tickets t where t.sector_id = @sector_id and t.created_by_id is not null)
   or u.id in (
       select (a.changes -> 'assignee_id' ->> 'to')::bigint
       from audit_logs a
       join tickets t on t.id = a.ticket_id
       where t.sector_id = @sector_id and a.changes -> 'assignee_id' ->> 'to' is not null)
order by lower(u.name), u.id;

-- name: DashboardModuleInSector :one
select exists (select 1 from modules m where m.id = @id and m.sector_id = @sector_id);
