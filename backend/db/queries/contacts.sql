-- name: CreateContact :one
insert into contacts (name, phone, organization_id, registered)
values (@name, @phone, @organization_id, true)
returning *;

-- name: UpdateContact :one
-- Saving a contact through the registration form marks it as registered.
update contacts
set name = @name, phone = @phone, organization_id = @organization_id, registered = true
where id = @id
returning *;

-- name: SetUnregisteredContactName :one
-- Keeps the contact unregistered; a registered contact is edited through the
-- registration form and returns no row.
update contacts
set name = @name
where id = @id and not registered
returning *;

-- name: GetContactWithOrganization :one
select sqlc.embed(c), o.name as organization_name, o.cnpj as organization_cnpj,
    o.municipality_id, m.name as municipality_name
from contacts c
left join organizations o on o.id = c.organization_id
left join municipalities m on m.id = o.municipality_id
where c.id = @id;

-- name: SearchContacts :many
-- Matches the name of the contact, organization or municipality (ignoring case
-- and accents), the phone digits or the organization CNPJ. Empty patterns disable
-- the phone and CNPJ keys; a zero sector, module, municipality or organization
-- disables that filter.
select sqlc.embed(c), o.name as organization_name, o.cnpj as organization_cnpj,
    o.municipality_id, m.name as municipality_name
from contacts c
left join organizations o on o.id = c.organization_id
left join municipalities m on m.id = o.municipality_id
where (@name_pattern::text = ''
       or immutable_unaccent(c.name) ilike immutable_unaccent(@name_pattern)
       or immutable_unaccent(o.name) ilike immutable_unaccent(@name_pattern)
       or immutable_unaccent(m.name) ilike immutable_unaccent(@name_pattern)
       or (@phone_pattern::text <> '' and c.phone like @phone_pattern)
       or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern))
  and (@sector_id::bigint = 0 or exists (
       select 1 from contact_sectors cs where cs.contact_id = c.id and cs.sector_id = @sector_id))
  and (@module_id::bigint = 0 or exists (
       select 1 from contact_modules cm where cm.contact_id = c.id and cm.module_id = @module_id))
  and (@municipality_id::bigint = 0 or o.municipality_id = @municipality_id)
  and (@organization_id::bigint = 0 or c.organization_id = @organization_id)
order by lower(c.name), c.id
limit @max_results;

-- name: ListSectorsOfContacts :many
select cs.contact_id, s.id, s.name
from contact_sectors cs
join sectors s on s.id = cs.sector_id
where cs.contact_id = any(@contact_ids::bigint[])
order by lower(s.name), s.id;

-- name: ListModulesOfContacts :many
select cm.contact_id, m.id, m.sector_id, m.name
from contact_modules cm
join modules m on m.id = cm.module_id
where cm.contact_id = any(@contact_ids::bigint[])
order by lower(m.name), m.id;

-- name: LinkContactSector :execrows
-- The contact enters the sector by itself: a repeated link has no effect and
-- affects no rows.
insert into contact_sectors (contact_id, sector_id)
values (@contact_id, @sector_id)
on conflict do nothing;

-- name: AddContactSectors :exec
insert into contact_sectors (contact_id, sector_id)
select @contact_id, unnest(@sector_ids::bigint[])
on conflict do nothing;

-- name: RemoveContactSectors :exec
delete from contact_sectors
where contact_id = @contact_id and sector_id = any(@sector_ids::bigint[]);

-- name: AddContactModules :exec
insert into contact_modules (contact_id, module_id, sector_id)
select @contact_id, id, sector_id from modules
where id = any(@module_ids::bigint[]);

-- name: RemoveContactModules :exec
delete from contact_modules
where contact_id = @contact_id and module_id = any(@module_ids::bigint[]);

-- name: GetContactByExternalID :one
select * from contacts where external_contact_id = @external_contact_id;

-- name: GetContactByPhone :one
-- Matches any of the phone variants (with or without the Brazilian ninth
-- digit), preferring the exact phone, given first.
select * from contacts
where phone = any(@phones::text[])
order by phone <> (@phones::text[])[1], id
limit 1;

-- name: SetContactExternalID :exec
update contacts set external_contact_id = @external_contact_id where id = @id;

-- name: CreateUnregisteredContact :one
-- A concurrent message of the same new contact may insert it first; then no
-- row is returned and the caller looks it up again.
insert into contacts (name, phone, external_contact_id, registered)
values (@name, @phone, @external_contact_id, false)
on conflict do nothing
returning *;

-- name: CreateImportedContact :one
-- A concurrent import or message may insert the same phone first; then no row
-- is returned and the caller looks it up again.
insert into contacts (name, phone, organization_id, registered)
values (@name, @phone, @organization_id, @registered)
on conflict do nothing
returning *;

-- name: LockContactPhone :exec
-- Serializes finding and creating the contact of a phone until the transaction
-- ends; the unique phone does not see the ninth digit variants as one number.
select pg_advisory_xact_lock(hashtextextended(@phone_key::text, 0));

-- name: ListExistingPhones :many
select phone::text from contacts where phone = any(@phones::text[]);

-- name: GetContactForShare :one
-- Keeps the registration of the contact from changing until the transaction ends.
select * from contacts where id = @id for share;
