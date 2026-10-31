-- name: CreateInternalNote :one
insert into internal_notes (ticket_id, author_id, body)
values (@ticket_id, @author_id, @body)
returning *;

-- name: ListTicketNotes :many
select n.id, n.body, n.created_at, n.author_id, u.name as author_name
from internal_notes n
join users u on u.id = n.author_id
where n.ticket_id = @ticket_id
order by n.created_at, n.id;
