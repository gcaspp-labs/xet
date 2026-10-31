-- +goose Up
create table internal_notes (
    id bigint generated always as identity primary key,
    ticket_id bigint not null references tickets (id),
    author_id bigint not null references users (id),
    body text not null check (btrim(body) <> ''),
    created_at timestamptz not null default now()
);

create index internal_notes_ticket_id_idx on internal_notes (ticket_id, created_at);

-- +goose Down
drop table internal_notes;
