-- name: ListMunicipalities :many
select id, name, audesp_code from municipalities
order by lower(immutable_unaccent(name));

-- name: ListMunicipalitiesWithOrganizations :many
select m.id, m.name from municipalities m
where exists (select 1 from organizations o where o.municipality_id = m.id)
order by lower(immutable_unaccent(m.name));
