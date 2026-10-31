-- +goose Up
create type user_role as enum ('agent', 'supervisor', 'admin');

create table users (
    id bigint generated always as identity primary key,
    name text not null check (btrim(name) <> ''),
    email text not null check (email like '%_@_%'),
    password_hash text not null,
    role user_role not null,
    sector_id bigint references sectors (id),
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint users_admin_without_sector check ((role = 'admin') = (sector_id is null))
);

create unique index users_email_key on users (lower(email));
create index users_sector_id_idx on users (sector_id);

create trigger users_set_updated_at before update on users
    for each row execute function set_updated_at();

create table sessions (
    id bigint generated always as identity primary key,
    token_hash text not null,
    user_id bigint not null references users (id) on delete cascade,
    expires_at timestamptz not null,
    last_seen_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    constraint sessions_token_hash_key unique (token_hash)
);

create index sessions_user_id_idx on sessions (user_id);

-- +goose Down
drop table sessions;
drop table users;
drop type user_role;
