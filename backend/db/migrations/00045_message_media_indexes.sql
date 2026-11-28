-- +goose Up
-- Índices da mídia da mensagem (ticket #514, docs/data-model.md). O chamado de
-- uma mídia é achado pelo anexo (`media_id`) ou pela miniatura da prévia do
-- link (`preview_media_id`); com os dois índices parciais, a consulta do
-- GetMediaFileTicket vira uma busca por bitmap em vez de varrer `messages` a
-- cada abertura de arquivo.
create index messages_media_id_idx on messages (media_id)
    where media_id is not null;
create index messages_preview_media_id_idx on messages (preview_media_id)
    where preview_media_id is not null;

-- +goose Down
drop index messages_preview_media_id_idx;
drop index messages_media_id_idx;
