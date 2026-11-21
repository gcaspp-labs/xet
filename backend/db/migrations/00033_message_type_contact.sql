-- +goose Up
-- Cartão de contato do WhatsApp (#323, spec #312, docs/data-model.md). O valor
-- novo só pode ser usado depois do commit, por isso a coluna e a restrição
-- ficam na migração seguinte. Os contatos recebidos antes, gravados como
-- 'unsupported', ficam como estão.
alter type message_type add value if not exists 'contact';

-- +goose Down
-- O Postgres não remove valor de enum; sem uso depois da migração seguinte
-- desfeita, ele fica sem efeito.
select 1;
