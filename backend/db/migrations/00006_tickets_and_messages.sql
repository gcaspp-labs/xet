-- +goose Up
-- Contato criado a partir de número identificado só por LID fica sem telefone
-- até ser cadastrado pelo atendente.
alter table contacts alter column phone drop not null;
alter table contacts add constraint contacts_registered_phone check (not registered or phone is not null);
create unique index contacts_external_contact_id_key on contacts (external_contact_id) where external_contact_id is not null;

create type ticket_status as enum ('queued', 'in_progress', 'closed');
create type closure_type as enum ('resolved', 'transferred');
create type message_direction as enum ('inbound', 'outbound');
create type message_origin as enum ('customer', 'agent', 'phone');
create type message_type as enum ('text', 'image', 'video', 'audio', 'document', 'unsupported');
create type message_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');

create table protocol_counters (
    year integer primary key,
    last_value integer not null
);

create table tickets (
    id bigint generated always as identity primary key,
    protocol text not null check (protocol ~ '^[0-9]{4}-[0-9]{6}$'),
    sector_id bigint not null references sectors (id),
    contact_id bigint not null references contacts (id),
    organization_id bigint references organizations (id),
    assignee_id bigint references users (id),
    status ticket_status not null,
    previous_ticket_id bigint references tickets (id),
    created_by_id bigint references users (id),
    spoke_with text,
    arrived_at timestamptz not null,
    assigned_at timestamptz,
    started_at timestamptz not null,
    ended_at timestamptz,
    closed_at timestamptz,
    closed_by_id bigint references users (id),
    closure_type closure_type,
    subject text,
    resolution text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint tickets_protocol_key unique (protocol),
    constraint tickets_previous_ticket_id_key unique (previous_ticket_id),
    constraint tickets_queued_unassigned check (status <> 'queued' or assignee_id is null),
    constraint tickets_assigned check (status = 'queued' or assignee_id is not null),
    constraint tickets_closed_fields check (
        status <> 'closed' or (
            organization_id is not null and ended_at is not null and closed_at is not null
            and closed_by_id is not null and closure_type is not null
            and subject is not null and resolution is not null
        )
    ),
    constraint tickets_ended_after_started check (ended_at is null or ended_at >= started_at)
);

-- Um chamado aberto por contato e setor.
create unique index tickets_open_contact_key on tickets (sector_id, contact_id) where status <> 'closed';
create index tickets_sector_id_status_idx on tickets (sector_id, status);
create index tickets_assignee_id_idx on tickets (assignee_id) where status = 'in_progress';
create index tickets_contact_id_idx on tickets (contact_id);
create index tickets_organization_id_idx on tickets (organization_id);

create trigger tickets_set_updated_at before update on tickets
    for each row execute function set_updated_at();

alter table audit_logs add constraint audit_logs_ticket_id_fkey foreign key (ticket_id) references tickets (id);

create table media_files (
    id bigint generated always as identity primary key,
    storage_key text not null check (btrim(storage_key) <> ''),
    mime_type text not null check (btrim(mime_type) <> ''),
    size_bytes bigint not null check (size_bytes >= 0),
    file_name text,
    sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
    duration_seconds integer check (duration_seconds >= 0),
    created_at timestamptz not null default now(),
    constraint media_files_storage_key_key unique (storage_key)
);

create table messages (
    id bigint generated always as identity primary key,
    ticket_id bigint not null references tickets (id),
    sector_id bigint not null references sectors (id),
    contact_id bigint not null references contacts (id),
    direction message_direction not null,
    origin message_origin not null,
    author_id bigint references users (id),
    type message_type not null,
    body text,
    media_id bigint references media_files (id),
    external_message_id text,
    client_request_id uuid,
    status message_status,
    failure_reason text,
    sent_at timestamptz not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint messages_inbound_customer check ((direction = 'inbound') = (origin = 'customer')),
    constraint messages_agent_author check ((origin = 'agent') = (author_id is not null)),
    constraint messages_media check (type not in ('image', 'video', 'audio', 'document') or media_id is not null)
);

-- Idempotência das mensagens recebidas (por número) e das enviadas pelo sistema.
create unique index messages_external_message_id_key on messages (sector_id, external_message_id) where external_message_id is not null;
create unique index messages_client_request_id_key on messages (client_request_id) where client_request_id is not null;
create index messages_ticket_id_sent_at_idx on messages (ticket_id, sent_at);

create trigger messages_set_updated_at before update on messages
    for each row execute function set_updated_at();

-- +goose Down
drop table messages;
drop table media_files;
alter table audit_logs drop constraint audit_logs_ticket_id_fkey;
drop table tickets;
drop table protocol_counters;
drop type message_status;
drop type message_type;
drop type message_origin;
drop type message_direction;
drop type closure_type;
drop type ticket_status;
drop index contacts_external_contact_id_key;
alter table contacts drop constraint contacts_registered_phone;
alter table contacts alter column phone set not null;
