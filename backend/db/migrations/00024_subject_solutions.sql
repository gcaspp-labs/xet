-- +goose Up
-- Soluções da lista de cada assunto (modelo-dados.md). A tabela nasce vazia, e
-- tickets.resolution continua guardando o próprio texto, sem ligação com ela.
-- O índice único usa md5(lower(body)), porque o texto pode passar do limite de
-- tamanho de uma entrada de índice.
create table subject_solutions (
    id bigint generated always as identity primary key,
    subject_id bigint not null references subjects (id) on delete cascade,
    body text not null check (btrim(body) <> '' and char_length(body) <= 10000),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index subject_solutions_subject_id_body_key on subject_solutions (subject_id, md5(lower(body)));

create trigger subject_solutions_set_updated_at before update on subject_solutions
    for each row execute function set_updated_at();

-- +goose Down
drop table subject_solutions;
