-- name: MessageExists :one
select exists (
    select 1 from messages where sector_id = @sector_id and external_message_id = @external_message_id
);

-- name: CreateMediaFile :one
insert into media_files (storage_key, mime_type, size_bytes, file_name, sha256, duration_seconds)
values (@storage_key, @mime_type, @size_bytes, @file_name, @sha256, @duration_seconds)
returning *;

-- name: CreateProviderMessage :one
-- Message that came from the provider (received, or sent from the phone).
-- A message already recorded returns no row.
insert into messages (ticket_id, sector_id, contact_id, direction, origin, type, body, media_id, external_message_id, status, sent_at)
values (@ticket_id, @sector_id, @contact_id, @direction, @origin, @type, @body, @media_id, @external_message_id, @status, @sent_at)
on conflict (sector_id, external_message_id) where external_message_id is not null do nothing
returning *;

-- name: ListLastMessages :many
-- Last message of each ticket, for the ticket lists.
select distinct on (ticket_id) ticket_id, type, body, origin, sent_at
from messages
where ticket_id = any(@ticket_ids::bigint[])
order by ticket_id, sent_at desc, id desc;

-- name: GetMessage :one
select * from messages
where id = @id;

-- name: GetMessageByClientRequestID :one
select * from messages
where client_request_id = @client_request_id;

-- name: CreateAgentMessage :one
-- Message sent by an agent through the system, recorded as pending before it
-- goes to the provider. A repeated request (same client_request_id) returns
-- no row.
insert into messages (ticket_id, sector_id, contact_id, direction, origin, author_id, type, body, media_id, client_request_id, status, sent_at)
values (@ticket_id, @sector_id, @contact_id, 'outbound', 'agent', @author_id, @type, @body, @media_id, @client_request_id, 'pending', now())
on conflict (client_request_id) where client_request_id is not null do nothing
returning *;

-- name: MarkMessageSent :one
update messages
set status = 'sent', external_message_id = @external_message_id, failure_reason = null
where id = @id and status = 'pending'
returning *;

-- name: MarkMessageFailed :one
update messages
set status = 'failed', failure_reason = @failure_reason
where id = @id and status = 'pending'
returning *;

-- name: RetryMessage :one
-- Only a failed message goes back to pending, so a double click retries once.
update messages
set status = 'pending', failure_reason = null
where id = @id and status = 'failed'
returning *;

-- name: FailPendingMessages :execrows
-- Messages left pending by a previous run of the service: there is no
-- automatic resend, the agent retries them.
update messages
set status = 'failed', failure_reason = @failure_reason
where status = 'pending';

-- name: AdvanceMessageStatus :many
-- Delivery progress only moves forward: a late "delivered" never undoes
-- "read". A confirmed delivery also overrides a failure.
update messages
set status = @status, failure_reason = null
where sector_id = @sector_id and external_message_id = any(@external_message_ids::text[])
  and direction = 'outbound'
  and (case status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end)
    < (case @status::message_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 else 0 end)
returning ticket_id;

-- name: FailSentMessages :many
update messages
set status = 'failed', failure_reason = @failure_reason
where sector_id = @sector_id and external_message_id = any(@external_message_ids::text[])
  and direction = 'outbound' and status in ('pending', 'sent')
returning ticket_id;

-- name: ListTicketMessages :many
select
    m.id, m.ticket_id, m.direction, m.origin, m.type, m.body, m.status, m.failure_reason, m.sent_at,
    m.author_id, u.name as author_name,
    m.media_id, f.mime_type as media_mime_type, f.file_name as media_file_name, f.size_bytes as media_size_bytes,
    f.duration_seconds as media_duration_seconds
from messages m
left join users u on u.id = m.author_id
left join media_files f on f.id = m.media_id
where m.ticket_id = @ticket_id
order by m.sent_at, m.id;

-- name: GetMediaFile :one
select * from media_files
where id = @id;

-- name: GetMediaFileSector :one
-- Sector of the ticket whose message holds the file, to check the access.
select t.sector_id
from messages m
join tickets t on t.id = m.ticket_id
where m.media_id = @media_id
limit 1;
