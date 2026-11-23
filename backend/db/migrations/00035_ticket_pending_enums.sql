-- +goose Up
-- Chamado pendente e chamado mesclado (#333, spec #332, docs/data-model.md).
-- Os valores novos só podem ser usados depois do commit, por isso as colunas,
-- o índice e as restrições ficam na migração seguinte.
alter type ticket_status add value if not exists 'pending' before 'closed';
alter type closure_type add value if not exists 'merged';

-- +goose Down
-- O Postgres não remove valor de enum; sem uso depois da migração seguinte
-- desfeita, ele fica sem efeito.
select 1;
