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

-- name: CountSubjects :one
-- Counts the subjects of the sector the filter finds: the module (a zero module
-- with no unclassified means all) and the search, which matches the name of the
-- subject or the text of one of its solutions, without accents or case. Keep the
-- filter equal to SearchSubjects.
select count(*)
from subjects s
where s.sector_id = @sector_id
  and (@module_id::bigint = 0 or s.module_id = @module_id)
  and (not @unclassified::bool or s.module_id is null)
  and (@search_pattern::text = ''
       or immutable_unaccent(s.name) ilike immutable_unaccent(@search_pattern)
       or exists (select 1 from subject_solutions ss
                  where ss.subject_id = s.id
                    and immutable_unaccent(ss.body) ilike immutable_unaccent(@search_pattern)));

-- name: SearchSubjects :many
-- A page of the subjects of the sector, with the filter of CountSubjects, sorted
-- by the name (default) or the module name, subjects without a module last,
-- ignoring case and accents, with the id breaking ties in the same direction.
select sqlc.embed(s), m.name as module_name
from subjects s
left join modules m on m.id = s.module_id
where s.sector_id = @sector_id
  and (@module_id::bigint = 0 or s.module_id = @module_id)
  and (not @unclassified::bool or s.module_id is null)
  and (@search_pattern::text = ''
       or immutable_unaccent(s.name) ilike immutable_unaccent(@search_pattern)
       or exists (select 1 from subject_solutions ss
                  where ss.subject_id = s.id
                    and immutable_unaccent(ss.body) ilike immutable_unaccent(@search_pattern)))
order by
  case when @sort_column::text = 'module' and not @descending::bool then lower(immutable_unaccent(m.name)) end asc nulls last,
  case when @sort_column::text = 'module' and @descending::bool then lower(immutable_unaccent(m.name)) end desc nulls last,
  case when @sort_column::text = 'name' and not @descending::bool then lower(immutable_unaccent(s.name)) end asc,
  case when @sort_column::text = 'name' and @descending::bool then lower(immutable_unaccent(s.name)) end desc,
  case when not @descending::bool then s.id end asc,
  case when @descending::bool then s.id end desc
limit @page_size offset @page_offset;

-- name: ListPageSolutions :many
-- The solutions of the subjects of the page that the search shows: a subject
-- found by its name comes with all its solutions, and one found only by a
-- solution comes with the matching ones.
select ss.*
from subject_solutions ss
join subjects s on s.id = ss.subject_id
where ss.subject_id = any(@subject_ids::bigint[])
  and (@search_pattern::text = ''
       or immutable_unaccent(s.name) ilike immutable_unaccent(@search_pattern)
       or immutable_unaccent(ss.body) ilike immutable_unaccent(@search_pattern))
order by ss.subject_id, lower(immutable_unaccent(ss.body)), ss.id;

-- name: CountSubjectSolutions :many
-- How many solutions each subject of the page has, whatever the search shows.
select subject_id, count(*)::bigint as total
from subject_solutions
where subject_id = any(@subject_ids::bigint[])
group by subject_id;
