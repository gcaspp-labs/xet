-- +goose Up
-- Chamado cancelado (spec.md, Cancelamento). O valor novo só pode ser usado
-- depois do commit, por isso as restrições ficam na migração seguinte.
alter type closure_type add value if not exists 'cancelled';

-- +goose Down
-- O Postgres não remove valor de enum; sem uso depois da migração seguinte
-- desfeita, ele fica sem efeito.
select 1;
