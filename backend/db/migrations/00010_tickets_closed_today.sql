-- +goose Up
-- Realizados do dia no painel (spec.md, Recebimento e distribuição).
create index tickets_sector_id_closed_at_idx on tickets (sector_id, closed_at) where status = 'closed';

-- +goose Down
drop index tickets_sector_id_closed_at_idx;
