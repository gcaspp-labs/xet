-- +goose Up
-- Assuntos existentes permanecem sem módulo e mantêm suas soluções.
alter table subjects add column module_id bigint;
alter table subjects add constraint subjects_module_sector_fkey
    foreign key (module_id, sector_id) references modules (id, sector_id);
drop index subjects_sector_id_name_key;
create unique index subjects_module_name_key on subjects (module_id, lower(btrim(name))) where module_id is not null;
create unique index subjects_unclassified_name_key on subjects (sector_id, lower(btrim(name))) where module_id is null;

-- +goose Down
-- A reversão só é possível se os nomes forem únicos em cada setor.
drop index subjects_module_name_key;
drop index subjects_unclassified_name_key;
create unique index subjects_sector_id_name_key on subjects (sector_id, lower(name));
alter table subjects drop constraint subjects_module_sector_fkey;
alter table subjects drop column module_id;
