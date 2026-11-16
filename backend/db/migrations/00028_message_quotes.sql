-- +goose Up
-- Citação da mensagem (resposta citada, #201, docs/data-model.md). A citação
-- inteira é opcional, e o trecho também: o provedor pode entregar só o
-- identificador da citada. A ligação só aponta para mensagem do mesmo chamado
-- (chave estrangeira composta), para nunca expor o conteúdo de outro chamado.
alter table messages
    add column quoted_external_message_id text,
    add column quoted_message_id bigint,
    add column quoted_type message_type,
    add column quoted_body text,
    add constraint messages_id_ticket_id_key unique (id, ticket_id),
    add constraint messages_quote_same_ticket foreign key (quoted_message_id, ticket_id) references messages (id, ticket_id),
    add constraint messages_quote_external_id
        check (quoted_external_message_id is not null or (quoted_message_id is null and quoted_type is null and quoted_body is null)),
    add constraint messages_quote_body_type check (quoted_body is null or quoted_type is not null);

-- +goose Down
alter table messages
    drop constraint messages_quote_body_type,
    drop constraint messages_quote_external_id,
    drop constraint messages_quote_same_ticket,
    drop constraint messages_id_ticket_id_key,
    drop column quoted_body,
    drop column quoted_type,
    drop column quoted_message_id,
    drop column quoted_external_message_id;
