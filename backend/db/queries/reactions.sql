-- name: GetMessageRefByExternalID :one
-- Message a reaction points to, found by the provider ID in the sector.
select id, ticket_id from messages
where sector_id = @sector_id and external_message_id = @external_message_id;

-- name: GetMessageReactionEmoji :one
-- Reaction a side shows now: null when it was removed. No row: never reacted.
select emoji from message_reactions
where message_id = @message_id and side = @side;

-- name: UpsertMessageReaction :execrows
-- Sets the current reaction of a side. An event older than the last change of
-- the side (a reaction or a removal) changes nothing, and neither does the same
-- event delivered again. A removal at the same time as a reaction wins over it.
insert into message_reactions (message_id, side, emoji, author_id, via_phone, reacted_at)
values (@message_id, @side, @emoji, @author_id, @via_phone, @reacted_at)
on conflict (message_id, side) do update
set emoji = excluded.emoji, author_id = excluded.author_id, via_phone = excluded.via_phone, reacted_at = excluded.reacted_at
where message_reactions.reacted_at < excluded.reacted_at
   or (message_reactions.reacted_at = excluded.reacted_at
       and message_reactions.emoji is not null
       and (message_reactions.emoji, message_reactions.author_id, message_reactions.via_phone)
           is distinct from (excluded.emoji, excluded.author_id, excluded.via_phone));

-- name: RemoveMessageReaction :execrows
-- Removes the reaction of a side but keeps the time of the removal, so that an
-- older event delivered again does not bring the reaction back. A removal that
-- arrives before any reaction is recorded too. An older removal changes
-- nothing, and the same one delivered again neither.
insert into message_reactions (message_id, side, emoji, author_id, via_phone, reacted_at)
values (@message_id, @side, null, null, false, @reacted_at)
on conflict (message_id, side) do update
set emoji = null, author_id = null, via_phone = false, reacted_at = excluded.reacted_at
where message_reactions.reacted_at < excluded.reacted_at
   or (message_reactions.reacted_at = excluded.reacted_at and message_reactions.emoji is not null);
