-- +goose Up
-- O arquivo indisponível não tem anexo (modelo-dados.md, messages).
alter table messages add constraint messages_media_unavailable
    check (type <> 'media_unavailable' or media_id is null);

-- +goose Down
alter table messages drop constraint messages_media_unavailable;
