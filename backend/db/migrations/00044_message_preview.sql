-- +goose Up
-- Prévia do link nas mensagens recebidas (spec #511, ticket #514,
-- docs/data-model.md). O servidor nunca abre o site: o endereço, o título, a
-- descrição e a miniatura são os que o WhatsApp entrega na mensagem.
alter table messages
    add column preview_url text,
    add column preview_title text,
    add column preview_description text,
    add column preview_media_id bigint references media_files (id),
    -- Endereço e título vêm juntos, só em mensagem recebida; descrição e
    -- miniatura são opcionais. Sem prévia, as quatro colunas ficam vazias.
    add constraint messages_preview_fields check (
        (preview_url is null) = (preview_title is null)
        and (preview_url is null or direction = 'inbound')
        and (preview_description is null or preview_url is not null)
        and (preview_media_id is null or preview_url is not null)
    ),
    -- O título do cartão nunca é texto em branco.
    add constraint messages_preview_title_not_blank
        check (preview_title is null or btrim(preview_title) <> '');

-- +goose Down
alter table messages
    drop constraint messages_preview_title_not_blank,
    drop constraint messages_preview_fields,
    drop column preview_media_id,
    drop column preview_description,
    drop column preview_title,
    drop column preview_url;
