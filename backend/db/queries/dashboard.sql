-- Numbers of the dashboard (spec.md, Dashboard do atendimento). A ticket came
-- in (it is "received") when it arrived from another sector or from the
-- customer; otherwise the team started it, in the system or on the phone. The
-- first message is the lowest id, the one that opened the ticket: sent_at
-- comes from the clock of the phone. A transferred ticket is received even if
-- the phone is the first to write in it.

-- name: DashboardCurrent :one
-- Tickets open right now, whatever the period.
select
    count(*) filter (where t.status = 'queued') as queued,
    count(*) filter (where t.status = 'in_progress'
        and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))) as in_progress
from tickets t
where t.status <> 'closed'
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
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
) a;

-- name: DashboardWait :one
-- Wait of the received tickets assumed in the period. assigned_at keeps the
-- first time, so the time after a return to the queue does not count. The
-- arrival comes from the clock of the sender: when it is after the assignment,
-- the wait is zero.
select
    count(*) as waited,
    coalesce(sum(greatest(extract(epoch from t.assigned_at - t.arrived_at), 0)), 0)::float8 as wait_seconds
from tickets t
where t.assigned_at >= @period_start::timestamptz and t.assigned_at < @period_end::timestamptz
  and (t.previous_ticket_id is not null or (t.created_by_id is null
      and (select m.origin from messages m where m.ticket_id = t.id order by m.id limit 1) is distinct from 'phone'))
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id));

-- name: DashboardClosures :one
-- Tickets closed in the period, by the real closing moment, and the handling
-- time: from the first assignment to the end of the form, which may be edited.
-- An end before the assignment and the cancelled tickets stay out of the average.
select
    count(*) filter (where t.closure_type = 'resolved') as resolved,
    count(*) filter (where t.closure_type = 'transferred') as transferred,
    count(*) filter (where t.closure_type = 'cancelled') as cancelled,
    count(*) filter (where t.closure_type <> 'cancelled' and t.ended_at >= t.assigned_at) as handled,
    coalesce(sum(extract(epoch from t.ended_at - t.assigned_at))
        filter (where t.closure_type <> 'cancelled' and t.ended_at >= t.assigned_at), 0)::float8 as handling_seconds
from tickets t
where t.status = 'closed' and t.closed_at >= @period_start::timestamptz and t.closed_at < @period_end::timestamptz
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
  and (sqlc.narg(module_id)::bigint is null
      or exists (select 1 from ticket_modules tm where tm.ticket_id = t.id and tm.module_id = sqlc.narg(module_id)));

-- name: DashboardByAssignee :many
-- One row per person and sector, with the rules of the numbers above. Only
-- what counts makes a row, so nobody appears with everything at zero. With a
-- module, only the closings that apply to it count.
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
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
    union all
    select t.sector_id, t.created_by_id,
        0, 1, 0, 0, 0, 0, 0::float8
    from tickets t
    where t.created_by_id is not null and sqlc.narg(module_id)::bigint is null
      and t.arrived_at >= @period_start::timestamptz and t.arrived_at < @period_end::timestamptz
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.created_by_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
    union all
    select t.sector_id, t.assignee_id,
        0, 0,
        (t.closure_type = 'resolved')::int,
        (t.closure_type = 'transferred')::int,
        (t.closure_type = 'cancelled')::int,
        case when t.closure_type <> 'cancelled' and t.ended_at >= t.assigned_at then 1 else 0 end,
        case when t.closure_type <> 'cancelled' and t.ended_at >= t.assigned_at
            then extract(epoch from t.ended_at - t.assigned_at)::float8 else 0::float8 end
    from tickets t
    where t.status = 'closed' and t.closed_at >= @period_start::timestamptz and t.closed_at < @period_end::timestamptz
      and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
      and (sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
      and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
      and (sqlc.narg(module_id)::bigint is null or (t.closure_type <> 'cancelled'
          and exists (select 1 from ticket_modules tm where tm.ticket_id = t.id and tm.module_id = sqlc.narg(module_id))))
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
