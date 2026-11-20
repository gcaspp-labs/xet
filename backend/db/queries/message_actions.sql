-- name: GetMessageActionByClientRequestID :one
select * from message_actions
where client_request_id = @client_request_id;

-- name: GetMessageActionForUpdate :one
select * from message_actions
where id = @id
for update;

-- name: CreateMessageAction :one
-- An edit or a deletion asked in the panel, recorded before it goes to the
-- provider; a local deletion is recorded already accepted. A repeated request
-- (same client_request_id) returns no row; a second action while one is in
-- flight on the message breaks message_actions_in_flight_key.
insert into message_actions (client_request_id, message_id, ticket_id, sector_id, author_id, kind, body, status, finished_at)
values (
    @client_request_id, @message_id, @ticket_id, @sector_id, @author_id, @kind, @body, @status,
    case when @status::message_action_status = 'pending' then null else now() end
)
on conflict (client_request_id) do nothing
returning *;

-- name: MessageActionInFlight :one
-- Whether the message has an action waiting for the provider. Asked with the
-- ticket locked, as every action of the message is decided and settled.
select exists (
    select 1 from message_actions where message_id = @message_id and status = 'pending'
);

-- name: FinishMessageAction :one
-- The answer of the provider to an action in flight. An action already
-- finished (by the echo of the provider, or marked uncertain on restart and
-- then confirmed by the echo) is not touched.
update message_actions
set status = @status, failure_reason = @failure_reason, external_event_id = @external_event_id, finished_at = now()
where id = @id and status = 'pending'
returning *;

-- name: AcceptUncertainMessageAction :one
-- The echo of the provider is the evidence that an action in flight, or one
-- whose result was not known, was applied.
update message_actions
set status = 'accepted', failure_reason = null, external_event_id = @external_event_id, finished_at = now()
where id = @id and status in ('pending', 'uncertain')
returning *;

-- name: FindEchoedMessageAction :one
-- The action of the panel a change made by the sector number may be the echo
-- of: the newest one on the message, of the same kind and content, still in
-- flight or with an unknown result.
select * from message_actions
where message_id = @message_id and kind = @kind
  and body is not distinct from sqlc.narg(body)::text
  and status in ('pending', 'uncertain')
order by created_at desc, id desc
limit 1;

-- name: UncertainPendingMessageActions :execrows
-- Actions left in flight by a previous run of the service: the provider may
-- or may not have applied them, so they are neither successes nor failures.
update message_actions
set status = 'uncertain', failure_reason = @failure_reason, finished_at = now()
where status = 'pending';

-- name: GetOriginalMessageBody :one
-- The content of the message as it was sent: the original version, once the
-- message was edited, or the content it still has.
select coalesce(
    (select c.body from message_changes c where c.message_id = m.id and c.kind = 'original'),
    m.body
)::text as body
from messages m
where m.id = @id;
