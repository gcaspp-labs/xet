-- +goose Up
-- Cartões da mensagem de contato (#323, spec #312, docs/data-model.md). Só
-- acréscimo: as mensagens existentes ficam sem cartões, sem mudar mais nada
-- nelas. Os cartões são o que veio na mensagem, sem ligação com contacts.
alter table messages
    add column contact_cards jsonb,
    add constraint messages_contact_cards check (
        (type = 'contact') = (contact_cards is not null)
        and (contact_cards is null
            or (jsonb_typeof(contact_cards) = 'array' and jsonb_array_length(contact_cards) > 0))
    );

-- +goose Down
-- Falha se já houver mensagem de contato: apagar os cartões perderia mensagens.
-- +goose StatementBegin
do $$
begin
    if exists (select 1 from messages where type = 'contact') then
        raise exception 'há mensagens de contato; os cartões não podem ser removidos';
    end if;
end $$;
-- +goose StatementEnd

alter table messages
    drop constraint messages_contact_cards,
    drop column contact_cards;
