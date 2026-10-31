-- +goose Up
-- ticket_id ganha a chave estrangeira na migração que cria tickets.
create table audit_logs (
    id bigint generated always as identity primary key,
    ticket_id bigint,
    entity_type text not null check (btrim(entity_type) <> ''),
    entity_id bigint not null,
    action text not null check (btrim(action) <> ''),
    actor_id bigint references users (id),
    reason text,
    changes jsonb,
    created_at timestamptz not null default now()
);

create index audit_logs_ticket_id_created_at_idx on audit_logs (ticket_id, created_at);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

-- +goose Down
drop table audit_logs;
