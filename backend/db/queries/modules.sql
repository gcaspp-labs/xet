-- name: CreateModule :one
insert into modules (sector_id, name)
values (@sector_id, @name)
returning *;

-- name: ListModules :many
select * from modules
where sector_id = @sector_id
order by active desc, lower(name);

-- name: GetModuleForUpdate :one
select * from modules
where id = @id and sector_id = @sector_id
for update;

-- name: UpdateModule :one
update modules
set name = @name, active = @active
where id = @id
returning *;

-- name: ListActiveModules :many
select * from modules
where sector_id = @sector_id and active
order by lower(name), id;

-- name: ListModuleNames :many
select id, name from modules
where id = any(@ids::bigint[]);
