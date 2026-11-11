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
-- An empty query lists them all. name_pattern is an ILIKE pattern compared
-- without accents with the names of the organization and its municipality;
-- cnpj_pattern is a LIKE pattern, empty when the query cannot be part of a CNPJ.
-- A zero municipality disables that filter. Keep the filter equal to
-- CountOrganizations. Sorts by the name (default), the municipality or the CNPJ
-- (organizations without one last), ignoring case and accents, then by the
-- name, the municipality and the id, in the same direction.
select sqlc.embed(o), m.name as municipality_name
from organizations o
join municipalities m on m.id = o.municipality_id
where (@name_pattern::text = ''
       or immutable_unaccent(o.name) ilike immutable_unaccent(@name_pattern)
       or immutable_unaccent(m.name) ilike immutable_unaccent(@name_pattern)
       or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern))
  and (@municipality_id::bigint = 0 or o.municipality_id = @municipality_id)
order by
  case when @sort_column::text = 'municipality' and not @descending::bool
       then lower(immutable_unaccent(m.name)) end asc,
  case when @sort_column::text = 'municipality' and @descending::bool
       then lower(immutable_unaccent(m.name)) end desc,
  case when @sort_column::text = 'cnpj' and not @descending::bool
       then o.cnpj end asc nulls last,
  case when @sort_column::text = 'cnpj' and @descending::bool
       then o.cnpj end desc nulls last,
  case when not @descending::bool then lower(immutable_unaccent(o.name)) end asc,
  case when @descending::bool then lower(immutable_unaccent(o.name)) end desc,
  case when not @descending::bool then lower(immutable_unaccent(m.name)) end asc,
  case when @descending::bool then lower(immutable_unaccent(m.name)) end desc,
  case when not @descending::bool then o.id end asc,
  case when @descending::bool then o.id end desc
limit @page_size offset @page_offset;

-- name: CountOrganizations :one
-- Counts the organizations SearchOrganizations finds, with the same filter.
select count(*)
from organizations o
join municipalities m on m.id = o.municipality_id
where (@name_pattern::text = ''
       or immutable_unaccent(o.name) ilike immutable_unaccent(@name_pattern)
       or immutable_unaccent(m.name) ilike immutable_unaccent(@name_pattern)
       or (@cnpj_pattern::text <> '' and o.cnpj like @cnpj_pattern))
  and (@municipality_id::bigint = 0 or o.municipality_id = @municipality_id);

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
