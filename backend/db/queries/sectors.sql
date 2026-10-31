-- name: CreateSector :one
insert into sectors (name, phone, provider)
values (@name, @phone, @provider)
returning *;

-- name: GetSector :one
select * from sectors
where id = @id;
