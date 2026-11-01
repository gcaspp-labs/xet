-- name: CreateSector :one
insert into sectors (name, provider)
values (@name, @provider)
returning *;

-- name: GetSector :one
select * from sectors
where id = @id;

-- name: ListSectors :many
select * from sectors
order by lower(name);

-- name: GetSectorForUpdate :one
select * from sectors
where id = @id
for update;

-- name: UpdateSector :one
update sectors
set name = @name
where id = @id
returning *;

-- name: UpdateSectorConnection :one
update sectors
set connection_status = @connection_status,
    external_account_id = @external_account_id,
    phone = @phone,
    connection_error = @connection_error,
    last_connected_at = case when @connection_status = 'connected'::connection_status then now() else last_connected_at end
where id = @id
returning *;

-- name: ListSectorsToReconnect :many
select * from sectors
where active and provider = @provider and external_account_id is not null
order by id;

-- name: ListActiveSectorIDs :many
select id from sectors
where id = any(@ids::bigint[]) and active;
