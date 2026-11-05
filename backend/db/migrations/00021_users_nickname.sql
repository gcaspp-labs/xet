-- +goose Up
-- Apelido que o cliente vê nas mensagens (modelo-dados.md). Os usuários existentes
-- recebem o primeiro e o último nome; em caso de repetição, o menor id fica com o
-- apelido e os demais recebem um número. Cada candidato é conferido contra os já
-- gravados, porque um nome pode gerar sozinho o mesmo texto de um número ("Ana 2").
alter table users add column nickname text;

-- +goose StatementBegin
do $$
declare
    u record;
    words text[];
    base text;
    candidate text;
    n int;
begin
    for u in select id, name from users order by id loop
        words := array_remove(regexp_split_to_array(u.name, '\s+'), '');
        base := case cardinality(words)
            when 0 then 'Usuário'
            when 1 then words[1]
            else words[1] || ' ' || words[cardinality(words)]
        end;
        candidate := base;
        n := 1;
        while exists (select 1 from users where lower(nickname) = lower(candidate)) loop
            n := n + 1;
            candidate := base || ' ' || n;
        end loop;
        update users set nickname = candidate where id = u.id;
    end loop;
end;
$$;
-- +goose StatementEnd

alter table users alter column nickname set not null;
alter table users add constraint users_nickname_check check (btrim(nickname) <> '');
create unique index users_nickname_key on users (lower(nickname));

-- +goose Down
alter table users drop column nickname;
