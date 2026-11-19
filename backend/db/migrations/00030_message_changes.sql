-- +goose Up
-- Alterações de mensagens já gravadas: edição e exclusão (#291, spec #290).
-- Nada é apagado: a mensagem guarda a versão atual e o estado da exclusão, e
-- `message_changes` guarda, sem nunca alterar nem excluir, a versão original e
-- cada alteração conhecida, com horário, origem e autor quando informado. É o
-- registro de alteração da mensagem.
create type message_change_kind as enum ('original', 'edit', 'deletion');
create type message_deletion_scope as enum ('everyone', 'local');

-- Estado da exclusão, separado da situação de entrega (`status`). O conteúdo e
-- o arquivo continuam gravados. `edited_at` é o horário da versão atual,
-- segundo o provedor; vazio quando a mensagem nunca foi editada.
alter table messages
    add column edited_at timestamptz,
    add column deleted_at timestamptz,
    add column deletion_scope message_deletion_scope,
    add column deletion_origin message_origin,
    add constraint messages_deletion_state check (
        (deleted_at is null and deletion_scope is null and deletion_origin is null)
        or (deleted_at is not null and deletion_scope is not null and deletion_origin is not null)
    );

-- Cada linha é uma versão (original ou edição) ou uma exclusão. Uma alteração
-- recebida antes da mensagem original fica sem `message_id`, só com o
-- identificador externo da mensagem alvo, e é ligada quando a original for
-- gravada.
create table message_changes (
    id bigint generated always as identity primary key,
    sector_id bigint not null references sectors (id),
    message_id bigint references messages (id),
    target_external_message_id text,
    kind message_change_kind not null,
    origin message_origin not null,
    author_id bigint references users (id),
    -- Contato da conversa informado pelo provedor, para conferir a alteração
    -- recebida antes da original com o contato da mensagem.
    external_contact_id text,
    phone text,
    body text,
    deletion_scope message_deletion_scope,
    -- Identificador da alteração no provedor, quando ele informa: reentrega e
    -- eco do mesmo evento não gravam de novo.
    external_event_id text,
    occurred_at timestamptz not null,
    created_at timestamptz not null default now(),
    constraint message_changes_target check (message_id is not null or target_external_message_id is not null),
    constraint message_changes_original check (kind <> 'original' or (message_id is not null and external_event_id is null)),
    constraint message_changes_deletion check ((kind = 'deletion') = (deletion_scope is not null)),
    constraint message_changes_deletion_body check (kind <> 'deletion' or body is null),
    constraint message_changes_agent_author check (origin = 'agent' or author_id is null)
);

create unique index message_changes_external_event_key on message_changes (sector_id, external_event_id)
    where external_event_id is not null;
create unique index message_changes_original_key on message_changes (message_id) where kind = 'original';
create index message_changes_message_idx on message_changes (message_id, occurred_at, id);
create index message_changes_pending_idx on message_changes (sector_id, target_external_message_id)
    where message_id is null;

-- +goose Down
drop table message_changes;
alter table messages
    drop constraint messages_deletion_state,
    drop column deletion_origin,
    drop column deletion_scope,
    drop column deleted_at,
    drop column edited_at;
drop type message_deletion_scope;
drop type message_change_kind;
