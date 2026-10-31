-- name: CreateSector :one
insert into sectors (name, phone, provider)
values (@name, @phone, @provider)
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
set name = @name, phone = @phone
where id = @id
returning *;
