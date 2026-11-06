-- +goose Up
-- Assuntos da lista de cada setor (modelo-dados.md). A tabela nasce vazia, e
-- tickets.subject continua guardando o próprio texto, sem ligação com ela.
create table subjects (
    id bigint generated always as identity primary key,
    sector_id bigint not null references sectors (id),
    name text not null check (btrim(name) <> '' and char_length(name) <= 500),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index subjects_sector_id_name_key on subjects (sector_id, lower(name));

create trigger subjects_set_updated_at before update on subjects
    for each row execute function set_updated_at();

-- +goose Down
drop table subjects;
