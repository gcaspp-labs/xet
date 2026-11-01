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
    o.name as organization_name,
    t.assignee_id, u.name as assignee_name
from tickets t
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join users u on u.id = t.assignee_id
where t.sector_id = @sector_id and t.status <> 'closed'
order by t.arrived_at, t.id;

-- name: ListSectorWorkload :many
-- Active users of the sector and anyone else (such as an admin) with tickets
-- in progress there, with the number of tickets in progress of each one.
select u.id, u.name, u.role, u.active, count(t.id)::integer as active_tickets
from users u
left join tickets t on t.assignee_id = u.id and t.sector_id = @sector_id and t.status = 'in_progress'
where (u.sector_id = @sector_id and u.active) or t.id is not null
group by u.id
order by lower(u.name), u.id;

-- name: GetTicketForUpdate :one
select * from tickets
where id = @id
for update;

-- name: GetTicketDetail :one
select
    t.id, t.protocol, t.status, t.sector_id, s.name as sector_name, t.spoke_with,
    t.arrived_at, t.assigned_at, t.started_at, t.ended_at, t.closed_at, t.subject, t.resolution,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    t.organization_id, o.name as organization_name,
    t.assignee_id, u.name as assignee_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join users u on u.id = t.assignee_id
where t.id = @id;

-- name: SetTicketSpokeWith :one
update tickets
set spoke_with = @spoke_with
where id = @id
returning *;

-- name: ListContactTickets :many
-- History of the contact, newest first. A null sector lists every sector (admin).
select
    t.id, t.protocol, t.status, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
    c.name as contact_name, o.name as organization_name, u.name as assignee_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join users u on u.id = t.assignee_id
where t.contact_id = @contact_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
order by t.arrived_at desc, t.id desc
limit 200;

-- name: ListOrganizationTickets :many
-- History of the organization, newest first. A null sector lists every sector (admin).
select
    t.id, t.protocol, t.status, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
    c.name as contact_name, o.name as organization_name, u.name as assignee_name
from tickets t
join sectors s on s.id = t.sector_id
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join users u on u.id = t.assignee_id
where t.organization_id = @organization_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
order by t.arrived_at desc, t.id desc
limit 200;

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
set status = 'closed', closure_type = 'resolved', closed_at = now(), closed_by_id = assignee_id,
    subject = @subject, resolution = @resolution, organization_id = @organization_id,
    started_at = @started_at, ended_at = coalesce(sqlc.narg(ended_at), now())
where id = @id
returning *;

-- name: ListTicketModules :many
select m.id, m.name
from ticket_modules tm
join modules m on m.id = tm.module_id
where tm.ticket_id = @ticket_id
order by lower(m.name), m.id;
