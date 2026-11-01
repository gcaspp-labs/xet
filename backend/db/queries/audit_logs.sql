-- name: CreateAuditLog :exec
insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, reason, changes)
values (@ticket_id, @entity_type, @entity_id, @action, @actor_id, @reason, @changes);

-- name: ListAuditLogsByEntity :many
select * from audit_logs
where entity_type = @entity_type and entity_id = @entity_id
order by created_at, id;

-- name: ListTicketAssignmentLogs :many
-- Start, assignment, transfers and closing of the ticket, oldest first, with the names of
-- the actor and of the previous and new assignees.
select
    a.id, a.action, a.created_at,
    a.actor_id, actor.name as actor_name,
    from_user.name as from_name,
    to_user.name as to_name
from audit_logs a
left join users actor on actor.id = a.actor_id
left join users from_user on from_user.id = (a.changes -> 'assignee_id' ->> 'from')::bigint
left join users to_user on to_user.id = (a.changes -> 'assignee_id' ->> 'to')::bigint
where a.ticket_id = @ticket_id and a.action in ('ticket_started', 'ticket_assigned', 'ticket_transferred_user', 'ticket_closed')
order by a.created_at, a.id;
