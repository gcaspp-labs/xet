-- name: CreateAuditLog :exec
insert into audit_logs (ticket_id, entity_type, entity_id, action, actor_id, reason, changes)
values (@ticket_id, @entity_type, @entity_id, @action, @actor_id, @reason, @changes);

-- name: ListAuditLogsByEntity :many
select * from audit_logs
where entity_type = @entity_type and entity_id = @entity_id
order by created_at, id;
