-- +goose Up
-- Foto de perfil do contato vinda do WhatsApp (spec #482, ticket #485,
-- docs/data-model.md). Só o modelo: nenhuma busca nem rota ainda. Os contatos
-- existentes ficam sem foto e com a busca nunca feita.
alter table contacts
    add column photo_media_id bigint references media_files (id),
    add column photo_thumbnail_media_id bigint references media_files (id),
    add column photo_external_id text,
    add column photo_checked_at timestamptz,
    -- Sem foto, os três campos ficam vazios juntos; com foto, os três vêm juntos.
    add constraint contacts_photo_fields check (
        (photo_media_id is null) = (photo_thumbnail_media_id is null)
        and (photo_media_id is null) = (photo_external_id is null)
    ),
    -- O identificador da foto no WhatsApp nunca é texto em branco.
    add constraint contacts_photo_external_id_not_blank
        check (photo_external_id is null or btrim(photo_external_id) <> '');

-- +goose Down
alter table contacts
    drop constraint contacts_photo_external_id_not_blank,
    drop constraint contacts_photo_fields,
    drop column photo_checked_at,
    drop column photo_external_id,
    drop column photo_thumbnail_media_id,
    drop column photo_media_id;
