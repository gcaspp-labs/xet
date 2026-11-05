-- name: ListSubjects :many
select * from subjects
where sector_id = @sector_id
order by lower(name), id;

-- name: CreateSubject :one
insert into subjects (sector_id, name)
values (@sector_id, @name)
returning *;

-- name: AddSubjectIfMissing :many
-- From the closing form: a subject someone else already added stays as it is,
-- and no row comes back.
insert into subjects (sector_id, name)
values (@sector_id, @name)
on conflict (sector_id, lower(name)) do nothing
returning *;

-- name: GetSubjectForUpdate :one
select * from subjects
where id = @id and sector_id = @sector_id
for update;

-- name: UpdateSubject :one
update subjects
set name = @name
where id = @id
returning *;

-- name: DeleteSubject :exec
delete from subjects
where id = @id;
