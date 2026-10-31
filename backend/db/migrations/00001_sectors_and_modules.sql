-- +goose Up
-- +goose StatementBegin
create function set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;
-- +goose StatementEnd

create type connection_status as enum ('disconnected', 'connecting', 'connected', 'logged_out');

create table sectors (
    id bigint generated always as identity primary key,
    name text not null check (btrim(name) <> ''),
    phone text not null check (phone ~ '^[0-9]{10,15}$'),
    provider text not null check (provider in ('whatsmeow', 'cloud_api')),
    external_account_id text,
    connection_status connection_status not null default 'disconnected',
    last_connected_at timestamptz,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sectors_name_key unique (name),
    constraint sectors_phone_key unique (phone)
);

create trigger sectors_set_updated_at before update on sectors
    for each row execute function set_updated_at();

create table modules (
    id bigint generated always as identity primary key,
    sector_id bigint not null references sectors (id),
    name text not null check (btrim(name) <> ''),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index modules_sector_id_name_key on modules (sector_id, lower(name));

create trigger modules_set_updated_at before update on modules
    for each row execute function set_updated_at();

-- +goose Down
drop table modules;
drop table sectors;
drop type connection_status;
drop function set_updated_at();
