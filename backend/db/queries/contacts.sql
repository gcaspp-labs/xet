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
-- Matches the contact or organization name, the phone digits or the
-- organization CNPJ. Empty patterns disable the phone and CNPJ keys.
select sqlc.embed(c), o.name as organization_name, o.cnpj as organization_cnpj
from contacts c
left join organizations o on o.id = c.organization_id
where @name_pattern::text = ''
   or c.name ilike @name_pattern
   or o.name ilike @name_pattern
   or (@phone_pattern::text <> '' and c.phone like @phone_pattern)
   or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern)
order by lower(c.name), c.id
limit @max_results;
