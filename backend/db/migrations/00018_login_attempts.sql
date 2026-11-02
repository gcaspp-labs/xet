-- +goose Up
-- Tentativas de login erradas por e-mail e por IP (modelo-dados.md).
create table login_attempts (
    scope text not null,
    subject text not null,
    failures integer not null,
    last_failure_at timestamptz not null,
    locked_until timestamptz,
    primary key (scope, subject),
    constraint login_attempts_scope_check check (scope in ('email', 'ip'))
);

-- +goose Down
drop table login_attempts;
