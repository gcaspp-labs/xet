-- name: GetMessageRefByExternalID :one
-- Message a reaction points to, found by the provider ID in the sector.
select id, ticket_id from messages
where sector_id = @sector_id and external_message_id = @external_message_id;

-- name: UpsertMessageReaction :execrows
-- Sets the current reaction of a side. A reaction older than the recorded one
-- changes nothing, and neither does the same event delivered again.
insert into message_reactions (message_id, side, emoji, author_id, via_phone, reacted_at)
values (@message_id, @side, @emoji, @author_id, @via_phone, @reacted_at)
on conflict (message_id, side) do update
set emoji = excluded.emoji, author_id = excluded.author_id, via_phone = excluded.via_phone, reacted_at = excluded.reacted_at
where message_reactions.reacted_at <= excluded.reacted_at
  and (message_reactions.emoji, message_reactions.author_id, message_reactions.via_phone, message_reactions.reacted_at)
      is distinct from (excluded.emoji, excluded.author_id, excluded.via_phone, excluded.reacted_at);

-- name: DeleteMessageReaction :execrows
-- Removes the reaction of a side, unless it is newer than the removal.
delete from message_reactions
where message_id = @message_id and side = @side and reacted_at <= @reacted_at;
