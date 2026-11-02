-- Conta a tentativa antes de conferir a senha, na linha travada. Sem linha de
-- volta, o bloqueio está ativo e a tentativa não conta. Depois de 15 minutos a
-- contagem recomeça.
-- name: RegisterLoginAttempt :one
insert into login_attempts (scope, subject, failures, last_failure_at)
values (@scope, @subject, 1, now())
on conflict (scope, subject) do update
set failures = case
        when login_attempts.last_failure_at <= now() - interval '15 minutes' then 1
        else login_attempts.failures + 1
    end,
    last_failure_at = now(),
    locked_until = case
        when login_attempts.last_failure_at > now() - interval '15 minutes'
            and login_attempts.failures + 1 >= @max_failures::integer
        then now() + interval '15 minutes'
    end
where login_attempts.locked_until is null or login_attempts.locked_until <= now()
returning failures;

-- name: DeleteLoginAttempts :exec
delete from login_attempts
where scope = @scope and subject = @subject;

-- Devolve a tentativa de um login certo. Só a própria tentativa, para quem tem
-- uma conta não zerar a contagem do IP entre uma tentativa errada e outra.
-- name: RefundLoginAttempt :exec
update login_attempts
set failures = failures - 1,
    locked_until = case when failures - 1 < @max_failures::integer then null else locked_until end
where scope = @scope and subject = @subject;

-- name: DeleteStaleLoginAttempts :exec
delete from login_attempts
where last_failure_at <= now() - interval '15 minutes'
    and (locked_until is null or locked_until <= now());
