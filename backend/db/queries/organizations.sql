-- name: CreateOrganization :one
insert into organizations (name, cnpj, municipality_id)
values (@name, @cnpj, @municipality_id)
returning *;

-- name: GetOrganizationForUpdate :one
select * from organizations
where id = @id
for update;

-- name: UpdateOrganization :one
update organizations
set name = @name, cnpj = @cnpj, municipality_id = @municipality_id
where id = @id
returning *;

-- name: SearchOrganizations :many
-- An empty query lists by name. name_pattern is an ILIKE pattern compared
-- without accents with the names of the organization and its municipality;
-- cnpj_pattern is a LIKE pattern, empty when the query cannot be part of a CNPJ.
select sqlc.embed(o), m.name as municipality_name
from organizations o
join municipalities m on m.id = o.municipality_id
where @name_pattern::text = ''
   or immutable_unaccent(o.name) ilike immutable_unaccent(@name_pattern)
   or immutable_unaccent(m.name) ilike immutable_unaccent(@name_pattern)
   or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern)
order by lower(o.name), lower(m.name), o.id
limit @max_results;

-- name: GetOrganization :one
select sqlc.embed(o), m.name as municipality_name
from organizations o
join municipalities m on m.id = o.municipality_id
where o.id = @id;

-- name: ListOrganizationNames :many
select o.id, o.name, m.name as municipality_name
from organizations o
join municipalities m on m.id = o.municipality_id
where o.id = any(@ids::bigint[]);
