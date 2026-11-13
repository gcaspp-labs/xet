-- name: NextProtocolNumber :one
-- Locks the counter row of the year until the transaction ends.
insert into protocol_counters (year, last_value)
values (@year, 1)
on conflict (year) do update set last_value = protocol_counters.last_value + 1
returning last_value;

-- name: GetOpenTicketForUpdate :one
select * from tickets
where sector_id = @sector_id and contact_id = @contact_id and status <> 'closed'
for update;

-- name: CreateQueuedTicket :one
-- A concurrent message may open the ticket first; then no row is returned
-- and the caller locks the existing one.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, arrived_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'queued', @arrived_at, @arrived_at)
on conflict (sector_id, contact_id) where status <> 'closed' do nothing
returning *;

-- name: GetTicket :one
select * from tickets
where id = @id;

-- name: AssignTicket :one
-- Conditional update: only a queued ticket is assigned, so among concurrent
-- attempts only one returns a row.
update tickets
set assignee_id = @assignee_id, status = 'in_progress', assigned_at = coalesce(assigned_at, now())
where id = @id and status = 'queued'
returning *;

-- name: ListOpenTickets :many
-- Open tickets of the sector with the contact and the assignee, oldest first.
select
    t.id, t.protocol, t.status, t.arrived_at, t.assigned_at,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    t.assignee_id, u.name as assignee_name
from tickets t
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
where t.sector_id = @sector_id and t.status <> 'closed'
order by t.arrived_at, t.id;

-- name: ListDashboardTickets :many
-- assigned_at on the ticket is the first assignment; after a return to the
-- queue the board shows when the present attendance started instead.
select t.id, t.protocol, t.status, t.arrived_at,
    coalesce((select a.created_at from audit_logs a
              where a.ticket_id = t.id and a.action in ('ticket_assigned', 'ticket_started')
              order by a.id desc limit 1), t.assigned_at) as assigned_at,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    t.assignee_id, u.name as assignee_name, s.id as sector_id, s.name as sector_name
from tickets t
join contacts c on c.id = t.contact_id
join sectors s on s.id = t.sector_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
where t.status <> 'closed'
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
  and (t.status = 'queued' or sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
order by t.arrived_at, t.id;

-- name: ListClosedTickets :many
-- Tickets of the sector closed in the period, by the real closing moment,
-- with the contact and who closed them, latest first.
select
    t.id, t.protocol, t.closure_type, t.closed_at,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    t.closed_by_id, u.name as closed_by_name
from tickets t
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
join users u on u.id = t.closed_by_id
where t.sector_id = @sector_id and t.status = 'closed' and t.closed_at >= @closed_from and t.closed_at < @closed_until
order by t.closed_at desc, t.id desc;

-- name: ListSectorWorkload :many
-- Active users of the sector and anyone else (such as an admin) with tickets
-- in progress there, with the number of tickets in progress of each one.
select u.id, u.name, u.role, u.active, count(t.id)::integer as active_tickets
from users u
left join tickets t on t.assignee_id = u.id and t.sector_id = @sector_id and t.status = 'in_progress'
where (u.sector_id = @sector_id and u.active) or t.id is not null
group by u.id
order by lower(u.name), u.id;

-- name: CountInProgressTicketsOfAssignee :one
select count(*)::integer from tickets
where assignee_id = @assignee_id and status = 'in_progress';

-- name: GetTicketForUpdate :one
select * from tickets
where id = @id
for update;

-- name: GetTicketDetail :one
select
    t.id, t.protocol, t.status, t.sector_id, s.name as sector_name, t.spoke_with,
    t.arrived_at, t.assigned_at, t.started_at, t.ended_at, t.closed_at, t.subject, t.resolution,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    t.organization_id, o.name as organization_name, o.municipality_id, m.name as municipality_name,
    t.assignee_id, u.name as assignee_name,
    t.closed_by_id, cb.name as closed_by_name, t.closure_type,
    p.id as previous_id, p.protocol as previous_protocol, ps.name as previous_sector_name,
    p.subject as previous_subject, p.resolution as previous_resolution, pb.name as previous_closed_by_name,
    n.id as next_id, n.protocol as next_protocol, ns.name as next_sector_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
left join users cb on cb.id = t.closed_by_id
left join tickets p on p.id = t.previous_ticket_id
left join sectors ps on ps.id = p.sector_id
left join users pb on pb.id = p.closed_by_id
left join tickets n on n.previous_ticket_id = t.id
left join sectors ns on ns.id = n.sector_id
where t.id = @id;

-- name: SetTicketSpokeWith :one
update tickets
set spoke_with = @spoke_with
where id = @id
returning *;

-- name: CountContactTickets :one
select count(*) from tickets t
where t.contact_id = @contact_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id));

-- name: ListContactTickets :many
select
    t.id, t.protocol, t.status, t.closure_type, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
    c.name as contact_name, o.name as organization_name, m.name as municipality_name, u.name as assignee_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
where t.contact_id = @contact_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
order by
    case when @sort::text = 'protocol' and @direction::text = 'asc' then lower(unaccent(t.protocol)) end asc nulls last,
    case when @sort::text = 'protocol' and @direction::text = 'desc' then lower(unaccent(t.protocol)) end desc nulls last,
    case when @sort::text = 'arrived' and @direction::text = 'asc' then t.arrived_at end asc nulls last,
    case when @sort::text = 'arrived' and @direction::text = 'desc' then t.arrived_at end desc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'asc' then lower(unaccent(c.name)) end asc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'desc' then lower(unaccent(c.name)) end desc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'asc' then lower(unaccent(s.name)) end asc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'desc' then lower(unaccent(s.name)) end desc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'asc' then lower(unaccent(u.name)) end asc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'desc' then lower(unaccent(u.name)) end desc nulls last,
    case when @sort::text = 'status' and @direction::text = 'asc' then case when t.closure_type = 'cancelled' then 'cancelado' when t.status = 'queued' then 'na fila' when t.status = 'in_progress' then 'em atendimento' else 'encerrado' end end asc nulls last,
    case when @sort::text = 'status' and @direction::text = 'desc' then case when t.closure_type = 'cancelled' then 'cancelado' when t.status = 'queued' then 'na fila' when t.status = 'in_progress' then 'em atendimento' else 'encerrado' end end desc nulls last,
    case when @direction::text = 'asc' then t.id end asc,
    case when @direction::text = 'desc' then t.id end desc
limit 20 offset @page_offset;

-- name: CountOrganizationTickets :one
select count(*) from tickets t
where t.organization_id = @organization_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id));

-- name: ListOrganizationTickets :many
select
    t.id, t.protocol, t.status, t.closure_type, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
    c.name as contact_name, o.name as organization_name, m.name as municipality_name, u.name as assignee_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
where t.organization_id = @organization_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
order by
    case when @sort::text = 'protocol' and @direction::text = 'asc' then lower(unaccent(t.protocol)) end asc nulls last,
    case when @sort::text = 'protocol' and @direction::text = 'desc' then lower(unaccent(t.protocol)) end desc nulls last,
    case when @sort::text = 'arrived' and @direction::text = 'asc' then t.arrived_at end asc nulls last,
    case when @sort::text = 'arrived' and @direction::text = 'desc' then t.arrived_at end desc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'asc' then lower(unaccent(c.name)) end asc nulls last,
    case when @sort::text = 'contact' and @direction::text = 'desc' then lower(unaccent(c.name)) end desc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'asc' then lower(unaccent(s.name)) end asc nulls last,
    case when @sort::text = 'sector' and @direction::text = 'desc' then lower(unaccent(s.name)) end desc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'asc' then lower(unaccent(u.name)) end asc nulls last,
    case when @sort::text = 'assignee' and @direction::text = 'desc' then lower(unaccent(u.name)) end desc nulls last,
    case when @sort::text = 'status' and @direction::text = 'asc' then case when t.closure_type = 'cancelled' then 'cancelado' when t.status = 'queued' then 'na fila' when t.status = 'in_progress' then 'em atendimento' else 'encerrado' end end asc nulls last,
    case when @sort::text = 'status' and @direction::text = 'desc' then case when t.closure_type = 'cancelled' then 'cancelado' when t.status = 'queued' then 'na fila' when t.status = 'in_progress' then 'em atendimento' else 'encerrado' end end desc nulls last,
    case when @direction::text = 'asc' then t.id end asc,
    case when @direction::text = 'desc' then t.id end desc
limit 20 offset @page_offset;

-- name: GetOpenTicketID :one
select id from tickets
where sector_id = @sector_id and contact_id = @contact_id and status <> 'closed';

-- name: CreateStartedTicket :one
-- Conversation started by an agent: the ticket is born assigned to them. A
-- ticket opened meanwhile for the contact in the sector wins; then no row is
-- returned and the caller directs the agent to it.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id, created_by_id, arrived_at, assigned_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'in_progress', @assignee_id, @assignee_id, now(), now(), now())
on conflict (sector_id, contact_id) where status <> 'closed' do nothing
returning *;

-- name: TransferTicket :one
-- The caller holds the lock of the ticket and checked it is in progress.
update tickets
set assignee_id = @assignee_id
where id = @id
returning *;

-- name: ReturnTicketToQueue :one
-- The caller holds the lock of the ticket and checked it is in progress.
-- assigned_at stays: it is the first time someone took the ticket.
update tickets
set status = 'queued', assignee_id = null
where id = @id
returning *;

-- name: AddTicketModules :many
-- Records the active modules of the sector among the given ones; the caller
-- compares the result with what was asked. Modules are locked for share so
-- none is deactivated meanwhile.
insert into ticket_modules (ticket_id, module_id)
select @ticket_id, m.id
from modules m
where m.id = any(@module_ids::bigint[]) and m.sector_id = @sector_id and m.active
for share of m
returning module_id;

-- name: CloseTicket :one
-- The caller holds the lock of the ticket and checked it may be closed.
update tickets
set status = 'closed', closure_type = @closure_type::closure_type, closed_at = now(), closed_by_id = assignee_id,
    subject = @subject, resolution = @resolution, organization_id = @organization_id,
    started_at = @started_at, ended_at = coalesce(sqlc.narg(ended_at), now())
where id = @id
returning *;

-- name: CancelTicket :one
-- The caller holds the lock of the ticket and checked it may be cancelled. A
-- ticket from the queue takes who cancelled as assignee, since a closed ticket
-- needs one (tickets_assigned), and assigned_at stays empty. The start comes
-- from the clock of the phone and may be ahead of the database.
update tickets
set status = 'closed', closure_type = 'cancelled', closed_at = now(), closed_by_id = @actor_id::bigint,
    assignee_id = coalesce(assignee_id, @actor_id::bigint), ended_at = greatest(now(), started_at)
where id = @id
returning *;

-- name: ListTicketModules :many
select m.id, m.name
from ticket_modules tm
join modules m on m.id = tm.module_id
where tm.ticket_id = @ticket_id
order by lower(m.name), m.id;

-- name: GetOpenTicketsOfContactForUpdate :many
-- Open tickets of the contact in every sector, locked in id order. Locking the
-- tickets before the contact keeps the order used by the closing.
select * from tickets
where contact_id = @contact_id and status <> 'closed'
order by id
for update;

-- name: SetTicketOrganization :one
update tickets
set organization_id = @organization_id
where id = @id
returning *;

-- name: ListTicketModuleIDs :many
select module_id from ticket_modules
where ticket_id = @ticket_id
order by module_id;

-- name: RemoveTicketModules :exec
delete from ticket_modules
where ticket_id = @ticket_id and module_id = any(@module_ids::bigint[]);

-- name: CorrectTicket :one
-- Correction of a closed ticket. The caller holds the lock of the ticket and
-- checked it may be corrected.
update tickets
set subject = @subject, resolution = @resolution, organization_id = @organization_id,
    started_at = @started_at, ended_at = @ended_at, spoke_with = @spoke_with
where id = @id
returning *;

-- name: CreateTransferredTicket :one
-- Ticket of the destination of a transfer between sectors. An open ticket of
-- the contact in the destination wins; then no row is returned and the
-- caller refuses the transfer.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, previous_ticket_id, arrived_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'queued', @previous_ticket_id, now(), now())
on conflict (sector_id, contact_id) where status <> 'closed' do nothing
returning *;

-- name: ListLaterTicketSectors :many
-- Sectors of the tickets that continue the given one through transfers
-- between sectors; their users read the whole chain before them.
with recursive later as (
    select f.id, f.sector_id from tickets f where f.previous_ticket_id = @id::bigint
    union all
    select t.id, t.sector_id from tickets t join later l on t.previous_ticket_id = l.id
)
select distinct sector_id from later;
