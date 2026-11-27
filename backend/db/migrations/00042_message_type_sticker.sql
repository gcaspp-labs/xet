-- +goose Up
-- Figurinha recebida do contato (#494, docs/data-model.md). Só acréscimo: a
-- figurinha vira imagem webp, baixada como as outras mídias. As mensagens
-- antigas gravadas como 'unsupported' ficam como estão, sem conversão.
alter type message_type add value if not exists 'sticker';

-- +goose Down
-- O Postgres não remove valor de enum; sem uso depois da migração desfeita,
-- ele fica sem efeito.
select 1;
