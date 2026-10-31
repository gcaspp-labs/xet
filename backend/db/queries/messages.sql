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
