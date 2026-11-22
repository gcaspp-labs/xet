-- name: MessageExists :one
select exists (
    select 1 from messages where sector_id = @sector_id and external_message_id = @external_message_id
);

-- name: CreateMediaFile :one
insert into media_files (storage_key, mime_type, size_bytes, file_name, sha256, duration_seconds)
values (@storage_key, @mime_type, @size_bytes, @file_name, @sha256, @duration_seconds)
returning *;

-- name: FindTicketMessageID :one
-- Message of the ticket with the provider ID, to link a quote. Only the same
-- ticket: a quote never links to a message of another ticket. The sector of
-- the ticket lets the search use the unique (sector_id, external_message_id).
select id from messages
where sector_id = @sector_id and external_message_id = @external_message_id and ticket_id = @ticket_id;

-- name: CreateProviderMessage :one
-- Message that came from the provider (received, or sent from the phone).
-- A message already recorded returns no row.
insert into messages (
    ticket_id, sector_id, contact_id, direction, origin, type, body, media_id, external_message_id, status, sent_at,
    quoted_external_message_id, quoted_message_id, quoted_type, quoted_body, contact_cards
)
values (
    @ticket_id, @sector_id, @contact_id, @direction, @origin, @type, @body, @media_id, @external_message_id, @status, @sent_at,
    @quoted_external_message_id, @quoted_message_id, @quoted_type, @quoted_body, @contact_cards
)
on conflict (sector_id, external_message_id) where external_message_id is not null do nothing
returning *;

-- name: ListLastMessages :many
-- Last message of each ticket, for the ticket lists, with who deleted it: the
-- list never shows content hidden by the system (deleted through the XET, for
-- me or for everyone), and the name of the first card of a contact message.
select distinct on (ticket_id) ticket_id, type, body, origin, sent_at, deletion_origin,
    coalesce(contact_cards -> 0 ->> 'name', '')::text as contact_name
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
-- goes to the provider, with the message of the ticket it quotes, if any, and
-- the cards of a contact message. A repeated request (same client_request_id)
-- returns no row.
insert into messages (
    ticket_id, sector_id, contact_id, direction, origin, author_id, type, body, media_id, client_request_id, status, sent_at,
    quoted_external_message_id, quoted_message_id, quoted_type, quoted_body, contact_cards
)
values (
    @ticket_id, @sector_id, @contact_id, 'outbound', 'agent', @author_id, @type, @body, @media_id, @client_request_id, 'pending', now(),
    @quoted_external_message_id, @quoted_message_id, @quoted_type, @quoted_body, @contact_cards
)
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
-- A deleted message is never sent again.
update messages
set status = 'pending', failure_reason = null
where id = @id and status = 'failed' and deleted_at is null
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
    f.duration_seconds as media_duration_seconds,
    rc.emoji as customer_reaction_emoji, rc.reacted_at as customer_reaction_at,
    rs.emoji as sector_reaction_emoji, rs.reacted_at as sector_reaction_at,
    rs.author_id as sector_reaction_author_id, ru.name as sector_reaction_author_name,
    rs.via_phone as sector_reaction_via_phone,
    m.quoted_external_message_id, m.quoted_message_id, m.quoted_type, m.quoted_body,
    m.edited_at, m.deleted_at, m.deletion_scope, m.deletion_origin, m.contact_cards
from messages m
left join users u on u.id = m.author_id
left join media_files f on f.id = m.media_id
left join message_reactions rc on rc.message_id = m.id and rc.side = 'customer'
left join message_reactions rs on rs.message_id = m.id and rs.side = 'sector'
left join users ru on ru.id = rs.author_id
where m.ticket_id = @ticket_id
order by m.sent_at, m.id;

-- name: GetMediaFile :one
select * from media_files
where id = @id;

-- name: GetMediaFileTicket :one
-- Ticket whose message holds the file, to check the access.
select m.ticket_id
from messages m
where m.media_id = @media_id
limit 1;

-- name: LockMessageExternalID :exec
-- Serializes, until the transaction ends, recording a message from the
-- provider and the changes (edit, deletion) that point at it, so a change
-- that arrives with the original is never left unlinked. Taken before the
-- ticket lock.
select pg_advisory_xact_lock(hashtextextended('message:' || @sector_id::bigint || ':' || @external_message_id::text, 0));

-- name: GetMessageForChange :one
-- Message of the sector with the provider ID, with its contact, to apply a
-- change received from the provider.
select m.id, m.ticket_id, m.origin, m.body, m.edited_at, m.deleted_at, m.deletion_scope,
       c.external_contact_id as contact_external_id, c.phone as contact_phone
from messages m
join contacts c on c.id = m.contact_id
where m.sector_id = @sector_id and m.external_message_id = @external_message_id;

-- name: MessageChangeEventExists :one
-- A change with the provider event ID was already recorded in the sector.
select exists (
    select 1 from message_changes where sector_id = @sector_id and external_event_id = @external_event_id
);

-- name: MessageChangeRecorded :one
-- The same change, by kind, time and content, is already recorded for the
-- message, or waiting for it when the message is unknown (message_id empty).
select exists (
    select 1 from message_changes
    where sector_id = @sector_id and kind = @kind and occurred_at = @occurred_at
      and body is not distinct from sqlc.narg(body)::text
      and origin = @origin
      and (message_id = sqlc.narg(message_id)::bigint
           or (sqlc.narg(message_id)::bigint is null and message_id is null
               and target_external_message_id = @target_external_message_id))
);

-- name: CreateMessageChange :one
-- A change of a message, or one waiting for it (message_id empty). The same
-- provider event recorded again returns no row.
insert into message_changes (
    sector_id, message_id, target_external_message_id, kind, origin, author_id,
    external_contact_id, phone, body, deletion_scope, external_event_id, occurred_at
)
values (
    @sector_id, @message_id, @target_external_message_id, @kind, @origin, @author_id,
    @external_contact_id, @phone, @body, @deletion_scope, @external_event_id, @occurred_at
)
on conflict (sector_id, external_event_id) where external_event_id is not null do nothing
returning id;

-- name: CreateOriginalVersion :exec
-- Keeps the content of the message as it was sent, before its first edit
-- replaces it. Only once per message.
insert into message_changes (sector_id, message_id, target_external_message_id, kind, origin, author_id, body, occurred_at)
select m.sector_id, m.id, m.external_message_id, 'original', m.origin, m.author_id, m.body, m.sent_at
from messages m
where m.id = @message_id
on conflict (message_id) where kind = 'original' do nothing;

-- name: RefreshMessageCurrentVersion :exec
-- The current content of an edited message is its newest recorded edit, by
-- the time of the provider (then the order received): a late edit is kept as
-- a version but never undoes a newer one, whatever text either has.
update messages m
set body = v.body, edited_at = v.occurred_at
from (
    select c.body, c.occurred_at from message_changes c
    where c.message_id = @id and c.kind = 'edit'
    order by c.occurred_at desc, c.id desc
    limit 1
) v
where m.id = @id;

-- name: MarkMessageDeleted :execrows
-- Deletion is a state of its own, apart from the delivery status, and keeps
-- the content and the file. The first deletion recorded holds: the time and
-- the author stay the ones of it, because the content is hidden since then.
-- The only exception is the alcance: a deletion for everyone widens one only
-- in the system, whether the provider took it (late, from an uncertain action)
-- or the sector's phone made it, and the contact no longer sees the message.
update messages
set deleted_at = coalesce(deleted_at, @deleted_at),
    deletion_scope = @deletion_scope,
    deletion_origin = coalesce(deletion_origin, @deletion_origin)
where id = @id and (deleted_at is null or (deletion_scope = 'local' and @deletion_scope::message_deletion_scope = 'everyone'));

-- name: ListPendingMessageChanges :many
-- Changes received before the message they point at, oldest first.
select * from message_changes
where sector_id = @sector_id and target_external_message_id = @target_external_message_id and message_id is null
order by occurred_at, id;

-- name: LinkMessageChange :exec
-- Links a change that arrived before its message, once.
update message_changes
set message_id = @message_id
where id = @id and message_id is null;

-- name: ListMessageChanges :many
-- Versions (original and edits) and deletions of the message, in the order
-- they happened.
select c.id, c.kind, c.origin, c.author_id, u.name as author_name, c.body, c.deletion_scope, c.occurred_at
from message_changes c
left join users u on u.id = c.author_id
where c.message_id = @message_id
order by c.occurred_at, c.id;
