-- name: ListSubjects :many
select * from subjects
where sector_id = @sector_id
order by lower(name), id;

-- name: CreateSubject :one
insert into subjects (sector_id, module_id, name)
values (@sector_id, @module_id, @name)
returning *;

-- name: AddSubjectIfMissing :many
-- From the closing form: a subject someone else already added stays as it is,
-- and no row comes back.
insert into subjects (sector_id, module_id, name)
values (@sector_id, @module_id, @name)
on conflict do nothing
returning *;

-- name: GetSubjectForUpdate :one
select * from subjects
where id = @id and sector_id = @sector_id
for update;

-- name: UpdateSubject :one
update subjects
set name = @name, module_id = @module_id
where id = @id
returning *;

-- name: DeleteSubject :exec
delete from subjects
where id = @id;

-- name: GetSubjectForShare :one
-- Holds the subject while one of its solutions is written, so it is not
-- deleted meanwhile.
select * from subjects
where id = @id and sector_id = @sector_id
for share;

-- name: GetSubjectByNameForShare :one
-- From the closing form: the subject of the list with the name of the form,
-- held while the solution is added.
select * from subjects
where sector_id = @sector_id and module_id = @module_id and lower(btrim(name)) = lower(btrim(@name))
for share;

-- name: ListSectorSolutions :many
-- The solutions of every subject of the sector.
select ss.* from subject_solutions ss
join subjects s on s.id = ss.subject_id
where s.sector_id = @sector_id
order by ss.subject_id, lower(ss.body), ss.id;

-- name: ListSubjectSolutions :many
select * from subject_solutions
where subject_id = @subject_id
order by lower(body), id;

-- name: ListSolutionBodies :many
select body from subject_solutions
where subject_id = @subject_id
order by lower(body), id;

-- name: CreateSolution :one
insert into subject_solutions (subject_id, body)
values (@subject_id, @body)
returning *;

-- name: AddSolutionIfMissing :many
-- From the closing form: a solution someone else already added stays as it is,
-- and no row comes back.
insert into subject_solutions (subject_id, body)
values (@subject_id, @body)
on conflict (subject_id, md5(lower(body))) do nothing
returning *;

-- name: GetSolutionForUpdate :one
select * from subject_solutions
where id = @id and subject_id = @subject_id
for update;

-- name: UpdateSolution :one
update subject_solutions
set body = @body
where id = @id
returning *;

-- name: DeleteSolution :exec
delete from subject_solutions
where id = @id;
