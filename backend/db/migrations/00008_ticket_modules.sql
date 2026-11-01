-- +goose Up
-- Módulos atendidos no chamado, gravados no encerramento. O módulo é do setor
-- do chamado (conferido na transação de encerramento).
create table ticket_modules (
    ticket_id bigint not null references tickets (id),
    module_id bigint not null references modules (id),
    created_at timestamptz not null default now(),
    primary key (ticket_id, module_id)
);

create index ticket_modules_module_id_idx on ticket_modules (module_id);

-- +goose Down
drop table ticket_modules;
