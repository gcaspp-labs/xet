-- +goose Up
-- Arquivo recebido acima do limite ou que não baixou (spec.md, Conversa). O
-- valor novo só pode ser usado depois do commit, por isso a restrição fica na
-- migração seguinte.
alter type message_type add value if not exists 'media_unavailable';

-- +goose Down
-- O Postgres não remove valor de enum; sem uso depois da migração seguinte
-- desfeita, ele fica sem efeito.
select 1;
