-- name: ListMunicipalities :many
select id, name, audesp_code from municipalities
order by lower(immutable_unaccent(name));
