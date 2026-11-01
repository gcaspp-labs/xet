-- name: CreateAuditLog :exec
insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, reason, changes)
values (@ticket_id, @entity_type, @entity_id, @action, @actor_id, @reason, @changes);

-- name: ListAuditLogsByEntity :many
select * from audit_logs
where entity_type = @entity_type and entity_id = @entity_id
-- created_at is the start of the transaction: a writer that waited for a lock
-- gets an earlier time than the one it waited for. The id follows the order
-- the rows were written.
order by id;

-- name: ListTicketAssignmentLogs :many
-- Start, assignment, transfers, closing, cancellation and corrections of the ticket, oldest first, with the names of
-- the actor, of the previous and new assignees and of the target of a transfer between sectors.
select
    a.id, a.action, a.created_at, a.reason,
    a.actor_id, actor.name as actor_name,
    from_user.name as from_name,
    to_user.name as to_name,
    to_sector.name as to_sector_name
from audit_logs a
left join users actor on actor.id = a.actor_id
left join users from_user on from_user.id = (a.changes -> 'assignee_id' ->> 'from')::bigint
left join users to_user on to_user.id = (a.changes -> 'assignee_id' ->> 'to')::bigint
left join sectors to_sector on to_sector.id = (a.changes -> 'sector_id' ->> 'to')::bigint
where a.ticket_id = @ticket_id and a.action in ('ticket_started', 'ticket_assigned', 'ticket_transferred_user', 'ticket_closed', 'ticket_transferred_sector', 'ticket_cancelled', 'ticket_corrected')
order by a.created_at, a.id;

-- name: ListTicketCorrections :many
-- Corrections of the closed ticket in the order they were written (each one
-- holds the lock of the ticket, so the id follows that order), with the name
-- of the author.
select a.id, a.created_at, a.reason, a.changes, a.actor_id, u.name as actor_name
from audit_logs a
left join users u on u.id = a.actor_id
where a.ticket_id = @ticket_id and a.action = 'ticket_corrected'
order by a.id;
