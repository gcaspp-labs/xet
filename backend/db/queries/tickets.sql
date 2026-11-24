-- name: NextProtocolNumber :one
-- Locks the counter row of the year until the transaction ends.
insert into protocol_counters (year, last_value)
values (@year, 1)
on conflict (year) do update set last_value = protocol_counters.last_value + 1
returning last_value;

-- name: GetOpenTicketForUpdate :one
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where sector_id = @sector_id and contact_id = @contact_id and status in ('queued', 'in_progress')
for update;

-- name: CreateQueuedTicket :one
-- A concurrent message may open the ticket first; then no row is returned
-- and the caller locks the existing one.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, arrived_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'queued', @arrived_at, @arrived_at)
on conflict (sector_id, contact_id) where status in ('queued', 'in_progress') do nothing
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: GetTicket :one
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where id = @id;

-- name: AssignTicket :one
-- Conditional update: only a queued ticket is assigned, so among concurrent
-- attempts only one returns a row. The reading of the assignee starts now: the
-- messages of the queue are already seen when it is taken. The moment is
-- clock_timestamp(), the instant of the update, to compare with the moment the
-- message was recorded (messages.created_at, also clock_timestamp()), not with
-- the start of the transactions.
update tickets
set assignee_id = @assignee_id, status = 'in_progress', assigned_at = coalesce(assigned_at, now()), assignee_read_at = clock_timestamp()
where id = @id and status = 'queued'
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ListOpenTickets :many
-- Open tickets of the sector with the contact and the assignee, oldest first,
-- and the unread count of each one: messages received from the customer
-- recorded after the assignee's reading. The queue has no assignee, so its
-- count is 0. The comparison uses messages.created_at, the instant the server
-- recorded the message, not sent_at, which comes from the phone. Both sides are
-- clock_timestamp(), so a message inserted by a transaction that was already
-- open when the reading was written is still newer than the reading.
select
    t.id, t.protocol, t.status, t.arrived_at, t.assigned_at,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    t.assignee_id, u.name as assignee_name,
    (select count(*)::integer from messages m
     where m.ticket_id = t.id and m.direction = 'inbound' and m.origin = 'customer'
       and t.status = 'in_progress' and t.assignee_read_at is not null
       and m.created_at > t.assignee_read_at) as unread_count
from tickets t
join contacts c on c.id = t.contact_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join users u on u.id = t.assignee_id
where t.sector_id = @sector_id and t.status in ('queued', 'in_progress')
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
where t.status in ('queued', 'in_progress')
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id))
  and (sqlc.narg(organization_id)::bigint is null or t.organization_id = sqlc.narg(organization_id))
  and (t.status = 'queued' or sqlc.narg(assignee_id)::bigint is null or t.assignee_id = sqlc.narg(assignee_id))
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

-- name: CountInProgressTicketsOfAssignee :one
select count(*)::integer from tickets
where assignee_id = @assignee_id and status = 'in_progress';

-- name: GetTicketForUpdate :one
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where id = @id
for update;

-- name: GetTicketDetail :one
select
    t.id, t.protocol, t.status, t.sector_id, s.name as sector_name,
    t.arrived_at, t.assigned_at, t.started_at, t.ended_at, t.closed_at, t.subject, t.resolution,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    t.organization_id, o.name as organization_name, o.municipality_id, m.name as municipality_name,
    t.assignee_id, u.name as assignee_name,
    t.closed_by_id, cb.name as closed_by_name, t.closure_type, t.channel,
    p.id as previous_id, p.protocol as previous_protocol, ps.name as previous_sector_name,
    p.subject as previous_subject, p.resolution as previous_resolution, pb.name as previous_closed_by_name,
    p.transfer_reason as previous_transfer_reason,
    n.id as next_id, n.protocol as next_protocol, ns.name as next_sector_name,
    t.transfer_reason as next_transfer_reason,
    t.pending_reason, t.pending_at, t.pending_by_id, pu.name as pending_by_name,
    t.merged_into_ticket_id as merged_into_id, mt.protocol as merged_into_protocol
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
left join users pu on pu.id = t.pending_by_id
left join tickets mt on mt.id = t.merged_into_ticket_id
where t.id = @id;

-- name: CountContactTickets :one
select count(*) from tickets t
where t.contact_id = @contact_id
  and (sqlc.narg(sector_id)::bigint is null or t.sector_id = sqlc.narg(sector_id));

-- name: ListContactTickets :many
select
    t.id, t.protocol, t.status, t.closure_type, t.channel, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
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
    t.id, t.protocol, t.status, t.closure_type, t.channel, s.name as sector_name, t.arrived_at, t.closed_at, t.subject,
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
where sector_id = @sector_id and contact_id = @contact_id and status in ('queued', 'in_progress');

-- name: CreateStartedTicket :one
-- Conversation started by an agent: the ticket is born assigned to them, with
-- the reading already at the moment of the start: the conversation's own
-- messages are not unread. A ticket opened meanwhile for the contact in the
-- sector wins; then no row is returned and the caller directs the agent to it.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, assignee_id, created_by_id, arrived_at, assigned_at, started_at, assignee_read_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'in_progress', @assignee_id, @assignee_id, now(), now(), now(), clock_timestamp())
on conflict (sector_id, contact_id) where status in ('queued', 'in_progress') do nothing
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: TransferTicket :one
-- The caller holds the lock of the ticket and checked it is in progress. The
-- reading restarts for the new assignee: the count starts from the transfer.
update tickets
set assignee_id = @assignee_id, assignee_read_at = clock_timestamp()
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ReturnTicketToQueue :one
-- The caller holds the lock of the ticket and checked it is in progress.
-- assigned_at stays: it is the first time someone took the ticket. The
-- reading is cleared: the ticket leaves the assignee's list, and whoever takes
-- it again starts without unread messages.
update tickets
set status = 'queued', assignee_id = null, assignee_read_at = null
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: MarkTicketPending :one
-- The caller holds the lock of the ticket and checked it is in progress with
-- the actor as assignee. The ticket leaves the assignee, who is kept as who
-- marked it; assigned_at stays: it is the first time someone took the ticket.
-- The reading is cleared, as in the return to the queue: there is no assignee
-- in pending, and whoever resumes it starts without unread messages.
update tickets
set status = 'pending', assignee_id = null, assignee_read_at = null,
    pending_reason = @pending_reason, pending_by_id = @pending_by_id, pending_at = now()
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ListPendingTickets :many
-- Pending tickets of the sector, the ones pending for longer first, with the
-- contact, the organization and who marked it (spec #332, #334). Everyone of
-- the sector sees them; the admin, in the sectors the panel asks for. The
-- organization is the one of the ticket, or the one of the contact while the
-- ticket has none: a contact registered while the ticket was pending already
-- shows there.
select
    t.id, t.protocol, t.pending_reason, t.pending_at,
    t.contact_id, c.name as contact_name, c.phone as contact_phone, c.registered as contact_registered,
    o.name as organization_name, m.name as municipality_name,
    co.name as contact_organization_name, cm.name as contact_municipality_name,
    t.pending_by_id, pu.name as pending_by_name,
    t.sector_id, s.name as sector_name
from tickets t
join contacts c on c.id = t.contact_id
join sectors s on s.id = t.sector_id
left join organizations o on o.id = t.organization_id
left join municipalities m on m.id = o.municipality_id
left join organizations co on co.id = c.organization_id
left join municipalities cm on cm.id = co.municipality_id
left join users pu on pu.id = t.pending_by_id
where t.sector_id = @sector_id and t.status = 'pending'
order by t.pending_at, t.id;

-- name: GetOpenTicketOfContactInSector :one
-- The ticket of the contact in the queue or in progress in the sector, if any,
-- with its protocol and assignee: a pending ticket is resumed only when the
-- contact has none, so a new message never falls in a pending one (#334).
select t.id, t.protocol, t.status, t.assignee_id, u.name as assignee_name
from tickets t
left join users u on u.id = t.assignee_id
where t.sector_id = @sector_id and t.contact_id = @contact_id and t.status in ('queued', 'in_progress')
order by t.id
limit 1;

-- name: ResumeTicket :one
-- The caller holds the lock of the ticket and checked it is pending. The
-- reading starts now, as when a ticket of the queue is taken. assigned_at
-- stays: it is the first time someone took the ticket. The fields of the
-- pending stay as they are; the history is in the audit.
update tickets
set status = 'in_progress', assignee_id = @assignee_id, assignee_read_at = clock_timestamp()
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ListPendingTicketsOfContactInSector :many
-- Pending tickets of the contact in the sector, the ones pending for longer
-- first: the choices of resuming a pending ticket from a new ticket (#335).
select t.id, t.protocol, t.pending_reason, t.pending_at, t.pending_by_id, pu.name as pending_by_name
from tickets t
join users pu on pu.id = t.pending_by_id
where t.contact_id = @contact_id and t.sector_id = @sector_id and t.status = 'pending'
order by t.pending_at, t.id;

-- name: MergeTicketIntoPending :one
-- The caller holds the lock of the ticket and checked it is in progress with
-- the actor as assignee. The merged ticket keeps its assignee, without
-- subject, resolution or modules; the link is never undone.
update tickets
set status = 'closed', closure_type = 'merged', merged_into_ticket_id = @merged_into_ticket_id,
    closed_at = now(), closed_by_id = @closed_by_id::bigint,
    ended_at = greatest(now(), started_at), subject = null, resolution = null
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: MoveMessagesToTicket :many
-- The messages of the merged ticket pass to the resumed one, with their
-- attachments, reactions, versions and actions (keyed by the message), keeping
-- their times. The caller holds the locks of both tickets. All rows change in
-- one statement, so the foreign key of a quote always finds its message in the
-- same ticket at the end of it.
update messages set ticket_id = @to_ticket_id
where ticket_id = @from_ticket_id
returning id;

-- name: MoveMessageActionsToTicket :exec
-- The edits and deletions of the messages that passed follow them to the
-- resumed ticket, where the answer of the provider applies them.
update message_actions set ticket_id = @to_ticket_id
where ticket_id = @from_ticket_id;

-- name: ClosePendingByMerge :one
-- The pending ticket A takes the situation and the closing data of B, the
-- closed one (#341, spec #332): the same closure_type, subject, resolution,
-- organization, end, closing and responsible. assigned_at and started_at of A
-- stay. The caller holds the locks of both tickets and of the contact.
update tickets
set status = 'closed', closure_type = @closure_type::closure_type,
    subject = @subject, resolution = @resolution, organization_id = @organization_id,
    ended_at = @ended_at::timestamptz, closed_at = @closed_at::timestamptz,
    closed_by_id = @closed_by_id::bigint, assignee_id = @assignee_id::bigint
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: MergeClosedTicket :one
-- The closed ticket B becomes merged into the pending A (#341, spec #332),
-- without subject, resolution or modules; its closing moment, end and
-- responsible stay as they are. The caller holds the locks of both tickets.
update tickets
set closure_type = 'merged', merged_into_ticket_id = @merged_into_ticket_id::bigint,
    subject = null, resolution = null
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: MoveTicketModulesToTicket :exec
-- The modules of B pass to A in the merge of a closed ticket into a pending
-- one (#341). A has none, but the conflict keeps a module the two already
-- share.
insert into ticket_modules (ticket_id, module_id)
select @to_ticket_id::bigint, tm.module_id from ticket_modules tm where tm.ticket_id = @from_ticket_id
on conflict do nothing;

-- name: DeleteTicketModules :exec
delete from ticket_modules where ticket_id = @ticket_id;

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
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: CancelTicket :one
-- The caller holds the lock of the ticket and checked it may be cancelled. A
-- ticket from the queue takes who cancelled as assignee, since a closed ticket
-- needs one (tickets_assigned), and assigned_at stays empty. The start comes
-- from the clock of the phone and may be ahead of the database.
update tickets
set status = 'closed', closure_type = 'cancelled', closed_at = now(), closed_by_id = @actor_id::bigint,
    assignee_id = coalesce(assignee_id, @actor_id::bigint), ended_at = greatest(now(), started_at)
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: CloseTransferredTicket :one
-- Origin of a transfer between sectors, without the closing form: no subject,
-- resolution or modules, and the end is the moment of the transfer. The
-- caller holds the lock of the ticket and checked it may be transferred. The
-- start comes from the clock of the phone and may be ahead of the database:
-- then it moves back to the transfer, so the end stays the transfer and is
-- never before the start.
update tickets
set status = 'closed', closure_type = 'transferred', closed_at = now(), closed_by_id = assignee_id,
    started_at = least(started_at, now()), ended_at = now(), transfer_reason = sqlc.narg(transfer_reason)
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ListTicketModules :many
select m.id, m.name
from ticket_modules tm
join modules m on m.id = tm.module_id
where tm.ticket_id = @ticket_id
order by lower(m.name), m.id;

-- name: GetOpenTicketsOfContactForUpdate :many
-- Open tickets of the contact in every sector, locked in id order. Locking the
-- tickets before the contact keeps the order used by the closing.
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where contact_id = @contact_id and status in ('queued', 'in_progress')
order by id
for update;

-- name: GetPendingTicketsOfContactForUpdate :many
-- Pending tickets of the contact in every sector, locked in id order after the
-- open ones, so the registration of the contact announces them (#334).
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where contact_id = @contact_id and status = 'pending'
order by id
for update;

-- name: SetTicketOrganization :one
update tickets
set organization_id = @organization_id
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

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
    started_at = @started_at, ended_at = @ended_at
where id = @id
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: CreateTransferredTicket :one
-- Ticket of the destination of a transfer between sectors. An open ticket of
-- the contact in the destination wins; then no row is returned and the
-- caller refuses the transfer.
insert into tickets (protocol, sector_id, contact_id, organization_id, status, previous_ticket_id, arrived_at, started_at)
values (@protocol, @sector_id, @contact_id, @organization_id, 'queued', @previous_ticket_id, now(), now())
on conflict (sector_id, contact_id) where status in ('queued', 'in_progress') do nothing
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: ListLaterTicketSectors :many
-- Sectors of the tickets that continue the given one through transfers
-- between sectors; their users read the whole chain before them.
with recursive later as (
    select f.id, f.sector_id from tickets f where f.previous_ticket_id = @id::bigint
    union all
    select t.id, t.sector_id from tickets t join later l on t.previous_ticket_id = l.id
)
select distinct sector_id from later;

-- name: CreatePhoneTicket :one
-- Registro por telefone: o chamado nasce encerrado, sem fila nem mensagens. A
-- chave de idempotência repetida (mesmo em requisições simultâneas) não cria
-- outro: nenhuma linha volta e quem chamou busca o registro já gravado. O
-- índice parcial de chamado aberto não o alcança, porque nasce closed.
insert into tickets (
    protocol, sector_id, contact_id, organization_id, status, channel, client_request_id,
    assignee_id, closed_by_id, closure_type, subject, resolution,
    arrived_at, assigned_at, started_at, ended_at, closed_at)
values (
    @protocol, @sector_id, @contact_id, @organization_id, 'closed', 'phone', @client_request_id,
    @actor_id, @actor_id, 'resolved', @subject, @resolution,
    @started_at, @started_at, @started_at, @ended_at, now())
on conflict (client_request_id) where client_request_id is not null do nothing
returning id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at;

-- name: GetTicketByClientRequestID :one
select id, protocol, sector_id, contact_id, organization_id, assignee_id, status, previous_ticket_id, created_by_id, arrived_at, assigned_at, started_at, ended_at, closed_at, closed_by_id, closure_type, subject, resolution, created_at, updated_at, transfer_reason, channel, client_request_id, pending_reason, pending_by_id, pending_at, merged_into_ticket_id, assignee_read_at from tickets
where client_request_id = @client_request_id;

-- name: MarkTicketRead :execrows
-- Marks the ticket as read for the current assignee (#313, spec #310). It only
-- applies to a ticket in progress and only moves the moment forward: a reading
-- with an earlier time does not move the value back nor change anything. The
-- value is the server's (clock_timestamp(), the instant of the update), never
-- the one of the screen clock.
update tickets
set assignee_read_at = clock_timestamp()
where id = @id and status = 'in_progress' and assignee_id = @assignee_id
  and (assignee_read_at is null or assignee_read_at < clock_timestamp());
