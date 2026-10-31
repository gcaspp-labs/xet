-- name: CreateUser :one
insert into users (name, email, password_hash, role, sector_id)
values (@name, @email, @password_hash, @role, @sector_id)
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
