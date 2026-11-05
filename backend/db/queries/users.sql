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

-- name: ListUsers :many
select * from users
order by lower(name), id;

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
