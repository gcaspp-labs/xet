-- +goose Up
-- Edição e exclusão pedidas pelo responsável na tela (#292, spec #290). Cada
-- pedido é gravado antes de ir ao provedor, com a chave de idempotência da
-- tela, e termina aceito, recusado ou incerto: repetir o pedido, reiniciar o
-- serviço ou receber o eco do provedor nunca repete a ação nem registra
-- sucesso sem a resposta do provedor. As versões e a exclusão aceitas ficam em
-- `message_changes`, como as feitas fora do XET.
create type message_action_kind as enum ('edit', 'delete_everyone', 'delete_local');
create type message_action_status as enum ('pending', 'accepted', 'refused', 'uncertain');

create table message_actions (
    id bigint generated always as identity primary key,
    client_request_id uuid not null unique,
    message_id bigint not null references messages (id),
    ticket_id bigint not null references tickets (id),
    sector_id bigint not null references sectors (id),
    author_id bigint not null references users (id),
    kind message_action_kind not null,
    -- Edição: o texto ou a legenda novos como vão ao cliente, com o apelido
    -- gravado no envio.
    body text,
    status message_action_status not null default 'pending',
    failure_reason text,
    -- Identificador da alteração no provedor, quando aceita: o eco do mesmo
    -- evento não grava outra versão.
    external_event_id text,
    created_at timestamptz not null default now(),
    finished_at timestamptz,
    constraint message_actions_edit_body check ((kind = 'edit') = (body is not null)),
    constraint message_actions_finished check ((status = 'pending') = (finished_at is null)),
    -- "Excluir para mim" não vai ao provedor: nasce aceita.
    constraint message_actions_local check (kind <> 'delete_local' or (status = 'accepted' and external_event_id is null))
);

-- Uma ação em andamento por mensagem: a segunda confirmação espera a primeira.
create unique index message_actions_in_flight_key on message_actions (message_id) where status = 'pending';
create index message_actions_message_idx on message_actions (message_id, created_at);

-- +goose Down
drop table message_actions;
drop type message_action_status;
drop type message_action_kind;
