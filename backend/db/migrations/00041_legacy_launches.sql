-- +goose Up
-- Lançamento no legado (spec #410, ticket #412, docs/data-model.md): a situação
-- de cada atendimento, a reserva de quem está lançando e a configuração do
-- automático. Só o banco: nenhuma rota ainda.
create type legacy_launch_status as enum ('pending', 'launched', 'failed');
create type legacy_launch_error as enum (
    'mapping_missing',
    'unavailable',
    'login_refused',
    'screen_unrecognized',
    'field_refused',
    'unknown_result'
);

create table legacy_launches (
    ticket_id bigint primary key references tickets (id),
    status legacy_launch_status not null default 'pending',
    legacy_number text,
    launched_at timestamptz,
    error_kind legacy_launch_error,
    error_reason text,
    attempts integer not null default 0,
    claimed_at timestamptz,
    claim_id uuid,
    next_attempt_at timestamptz,
    created_at timestamptz not null default now(),
    -- Lançado: sempre com o número e a data, nunca com erro.
    constraint legacy_launches_launched_fields check (
        status <> 'launched'
        or (legacy_number is not null and launched_at is not null and error_kind is null and error_reason is null)
    ),
    -- Erro: sempre com o tipo e o motivo.
    constraint legacy_launches_failed_fields check (
        status <> 'failed' or (error_kind is not null and error_reason is not null)
    ),
    -- A lançar: sem erro pendurado de uma tentativa anterior.
    constraint legacy_launches_pending_clear check (
        status <> 'pending' or (error_kind is null and error_reason is null)
    ),
    constraint legacy_launches_error_reason_not_blank check (
        error_reason is null or btrim(error_reason) <> ''
    ),
    -- A reserva é do par: quem reservou e com qual identificador.
    constraint legacy_launches_claim_fields check ((claimed_at is null) = (claim_id is null)),
    constraint legacy_launches_attempts_not_negative check (attempts >= 0)
);

-- O número que o legado devolveu não se repete, e a fila acha a próxima
-- tentativa pela data, só entre os lançamentos que ainda podem rodar.
create unique index legacy_launches_number_key on legacy_launches (legacy_number)
    where legacy_number is not null;
create index legacy_launches_queue_idx on legacy_launches (next_attempt_at)
    where status in ('pending', 'failed');

create table legacy_launch_settings (
    id smallint primary key default 1,
    automatic_enabled boolean not null default false,
    consecutive_failures integer not null default 0,
    paused_at timestamptz,
    paused_reason text,
    updated_at timestamptz not null default now(),
    constraint legacy_launch_settings_single_row check (id = 1),
    constraint legacy_launch_settings_failures_not_negative check (consecutive_failures >= 0),
    -- A pausa automática sempre diz por quê.
    constraint legacy_launch_settings_paused_fields check ((paused_at is null) = (paused_reason is null)),
    constraint legacy_launch_settings_paused_reason_not_blank check (
        paused_reason is null or btrim(paused_reason) <> ''
    )
);

insert into legacy_launch_settings (id) values (1);

-- De-para da tela "Cadastro de Atendimentos": o código do órgão (campo
-- Cliente), o setor e o usuário do atendente no legado. Sem unicidade: o mesmo
-- código pode se repetir. Vazio é gravado como nulo, nunca em branco.
alter table organizations
    add column legacy_code text,
    add constraint organizations_legacy_code_not_blank check (legacy_code is null or btrim(legacy_code) <> '');

alter table sectors
    add column legacy_sector text,
    add constraint sectors_legacy_sector_not_blank check (legacy_sector is null or btrim(legacy_sector) <> '');

alter table users
    add column legacy_user text,
    add constraint users_legacy_user_not_blank check (legacy_user is null or btrim(legacy_user) <> '');

-- +goose Down
alter table users
    drop constraint users_legacy_user_not_blank,
    drop column legacy_user;

alter table sectors
    drop constraint sectors_legacy_sector_not_blank,
    drop column legacy_sector;

alter table organizations
    drop constraint organizations_legacy_code_not_blank,
    drop column legacy_code;

drop table legacy_launch_settings;
drop table legacy_launches;
drop type legacy_launch_error;
drop type legacy_launch_status;
