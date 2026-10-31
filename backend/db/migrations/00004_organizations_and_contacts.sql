-- +goose Up
create extension if not exists pg_trgm;

create table organizations (
    id bigint generated always as identity primary key,
    name text not null check (btrim(name) <> ''),
    -- CNPJ numérico ou alfanumérico; os dígitos verificadores são validados no backend.
    cnpj char(14) check (cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$'),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index organizations_cnpj_key on organizations (cnpj) where cnpj is not null;
create index organizations_name_trgm_idx on organizations using gin (name gin_trgm_ops);

create trigger organizations_set_updated_at before update on organizations
    for each row execute function set_updated_at();

create table contacts (
    id bigint generated always as identity primary key,
    name text not null check (btrim(name) <> ''),
    phone text not null check (phone ~ '^[0-9]{10,15}$'),
    external_contact_id text,
    organization_id bigint references organizations (id),
    registered boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint contacts_phone_key unique (phone),
    constraint contacts_registered_organization check (not registered or organization_id is not null)
);

create index contacts_organization_id_idx on contacts (organization_id);
create index contacts_name_trgm_idx on contacts using gin (name gin_trgm_ops);
create index contacts_phone_trgm_idx on contacts using gin (phone gin_trgm_ops);

create trigger contacts_set_updated_at before update on contacts
    for each row execute function set_updated_at();

-- +goose Down
drop table contacts;
drop table organizations;
drop extension if exists pg_trgm;
