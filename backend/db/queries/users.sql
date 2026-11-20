-- name: CreateUser :one
insert into users (name, nickname, email, password_hash, role, sector_id)
values (@name, @nickname, @email, @password_hash, @role, @sector_id)
returning *;

-- name: GetUserByEmail :one
select * from users
where lower(email) = lower(@email);

-- name: GetUserForUpdate :one
select * from users
where id = @id
for update;

-- name: UpdateUserPassword :exec
update users
set password_hash = @password_hash
where id = @id;

-- name: CountUsers :one
-- Counts the users the search finds: the name, the nickname or the e-mail,
-- without accents or case. Keep the filter equal to SearchUsers.
select count(*)
from users u
where (@search_pattern::text = ''
       or immutable_unaccent(u.name) ilike immutable_unaccent(@search_pattern)
       or immutable_unaccent(u.nickname) ilike immutable_unaccent(@search_pattern)
       or immutable_unaccent(u.email) ilike immutable_unaccent(@search_pattern));

-- name: SearchUsers :many
-- A page of the users, with the filter of CountUsers, sorted by the name (the
-- default), the role label (Administrador, Atendente, Supervisor), the sector
-- name (users without a sector last) or the status (active first ascending),
-- ignoring case and accents, then by the name and the id in the same direction.
select sqlc.embed(u)
from users u
left join sectors s on s.id = u.sector_id
where (@search_pattern::text = ''
       or immutable_unaccent(u.name) ilike immutable_unaccent(@search_pattern)
       or immutable_unaccent(u.nickname) ilike immutable_unaccent(@search_pattern)
       or immutable_unaccent(u.email) ilike immutable_unaccent(@search_pattern))
order by
  case when @sort_column::text = 'role' and not @descending::bool
       then case u.role when 'admin' then 0 when 'agent' then 1 else 2 end end asc,
  case when @sort_column::text = 'role' and @descending::bool
       then case u.role when 'admin' then 0 when 'agent' then 1 else 2 end end desc,
  case when @sort_column::text = 'sector' and not @descending::bool
       then lower(immutable_unaccent(s.name)) end asc nulls last,
  case when @sort_column::text = 'sector' and @descending::bool
       then lower(immutable_unaccent(s.name)) end desc nulls last,
  case when @sort_column::text = 'status' and not @descending::bool then not u.active end asc,
  case when @sort_column::text = 'status' and @descending::bool then not u.active end desc,
  case when not @descending::bool then lower(immutable_unaccent(u.name)) end asc,
  case when @descending::bool then lower(immutable_unaccent(u.name)) end desc,
  case when not @descending::bool then u.id end asc,
  case when @descending::bool then u.id end desc
limit @page_size offset @page_offset;

-- name: UpdateUser :one
update users
set name = @name, nickname = @nickname, email = @email, role = @role, sector_id = @sector_id, active = @active
where id = @id
returning *;

-- name: GetUserNickname :one
select nickname from users
where id = @id;

-- name: GetUserForShare :one
-- Keeps the user from being deactivated or moved to another sector until the
-- transaction ends.
select * from users
where id = @id
for share;
