-- +goose Up
create extension if not exists unaccent;

-- unaccent() não é imutável porque o dicionário pode mudar; fixar o dicionário
-- permite usá-la nos índices da busca por nome.
-- +goose StatementBegin
create function immutable_unaccent(text) returns text
language sql immutable parallel safe strict
as $$ select public.unaccent('public.unaccent'::regdictionary, $1) $$;
-- +goose StatementEnd

drop index organizations_name_trgm_idx;
create index organizations_name_trgm_idx on organizations using gin (immutable_unaccent(name) gin_trgm_ops);

drop index contacts_name_trgm_idx;
create index contacts_name_trgm_idx on contacts using gin (immutable_unaccent(name) gin_trgm_ops);

-- +goose Down
drop index contacts_name_trgm_idx;
create index contacts_name_trgm_idx on contacts using gin (name gin_trgm_ops);

drop index organizations_name_trgm_idx;
create index organizations_name_trgm_idx on organizations using gin (name gin_trgm_ops);

drop function immutable_unaccent(text);
drop extension if exists unaccent;
