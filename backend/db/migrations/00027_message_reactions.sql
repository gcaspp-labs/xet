-- +goose Up
-- Reação atual de cada mensagem, uma por lado (cliente e setor), sem histórico
-- (#197, docs/data-model.md). As reações antigas, gravadas como mensagens
-- `unsupported`, ficam como estão.
create type reaction_side as enum ('customer', 'sector');

create table message_reactions (
    message_id bigint not null references messages (id),
    side reaction_side not null,
    emoji text not null check (btrim(emoji) <> ''),
    author_id bigint references users (id),
    via_phone boolean not null default false,
    reacted_at timestamptz not null,
    primary key (message_id, side),
    constraint message_reactions_customer_side check (side = 'sector' or (author_id is null and not via_phone)),
    constraint message_reactions_author_or_phone check (author_id is null or not via_phone)
);

-- +goose Down
drop table message_reactions;
drop type reaction_side;
