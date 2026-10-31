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

-- name: GetContactWithOrganization :one
select sqlc.embed(c), o.name as organization_name, o.cnpj as organization_cnpj
from contacts c
left join organizations o on o.id = c.organization_id
where c.id = @id;

-- name: SearchContacts :many
-- Matches the contact or organization name (ignoring case and accents), the
-- phone digits or the organization CNPJ. Empty patterns disable the phone and
-- CNPJ keys.
select sqlc.embed(c), o.name as organization_name, o.cnpj as organization_cnpj
from contacts c
left join organizations o on o.id = c.organization_id
where @name_pattern::text = ''
   or immutable_unaccent(c.name) ilike immutable_unaccent(@name_pattern)
   or immutable_unaccent(o.name) ilike immutable_unaccent(@name_pattern)
   or (@phone_pattern::text <> '' and c.phone like @phone_pattern)
   or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern)
order by lower(c.name), c.id
limit @max_results;

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
