-- +goose Up
-- Setores e módulos do contato (modelo-dados.md). O setor organiza a lista e
-- não restringe o acesso. Contatos sem chamado ficam sem setor até serem editados.
create table contact_sectors (
    contact_id bigint not null references contacts (id),
    sector_id  bigint not null references sectors (id),
    primary key (contact_id, sector_id)
);
create index contact_sectors_sector_contact_idx on contact_sectors (sector_id, contact_id);

create table contact_modules (
    contact_id bigint not null references contacts (id),
    module_id  bigint not null references modules (id),
    primary key (contact_id, module_id)
);
create index contact_modules_module_idx on contact_modules (module_id);

insert into contact_sectors (contact_id, sector_id)
select distinct contact_id, sector_id from tickets;

-- +goose Down
drop table contact_modules;
drop table contact_sectors;
