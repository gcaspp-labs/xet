-- name: CreateOrganization :one
insert into organizations (name, cnpj)
values (@name, @cnpj)
returning *;

-- name: GetOrganizationForUpdate :one
select * from organizations
where id = @id
for update;

-- name: UpdateOrganization :one
update organizations
set name = @name, cnpj = @cnpj
where id = @id
returning *;

-- name: SearchOrganizations :many
-- An empty query lists by name. name_pattern is an ILIKE pattern; cnpj_pattern
-- is a LIKE pattern, empty when the query cannot be part of a CNPJ.
select * from organizations
where @name_pattern::text = ''
   or name ilike @name_pattern
   or (@cnpj_pattern::text <> '' and cnpj like @cnpj_pattern)
order by lower(name), id
limit @max_results;
