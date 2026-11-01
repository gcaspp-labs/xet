-- +goose Up
-- O contato tem no máximo um módulo em cada setor, e o módulo é de um setor do
-- contato (modelo-dados.md). Tirar o setor do contato tira o módulo dele. Se já
-- houver mais de um módulo no mesmo setor, fica o mais antigo.
alter table contact_modules add column sector_id bigint;
update contact_modules cm set sector_id = m.sector_id from modules m where m.id = cm.module_id;
delete from contact_modules cm
using contact_modules older
where older.contact_id = cm.contact_id and older.sector_id = cm.sector_id and older.module_id < cm.module_id;
alter table contact_modules alter column sector_id set not null;

alter table modules add constraint modules_id_sector_id_key unique (id, sector_id);
insert into contact_sectors (contact_id, sector_id)
select contact_id, sector_id from contact_modules
on conflict do nothing;
alter table contact_modules
    add constraint contact_modules_contact_id_sector_id_key unique (contact_id, sector_id),
    add constraint contact_modules_module_sector_fkey
        foreign key (module_id, sector_id) references modules (id, sector_id),
    add constraint contact_modules_contact_sector_fkey
        foreign key (contact_id, sector_id) references contact_sectors (contact_id, sector_id) on delete cascade;

-- +goose Down
alter table contact_modules
    drop constraint contact_modules_contact_sector_fkey,
    drop constraint contact_modules_module_sector_fkey,
    drop constraint contact_modules_contact_id_sector_id_key,
    drop column sector_id;
alter table modules drop constraint modules_id_sector_id_key;
