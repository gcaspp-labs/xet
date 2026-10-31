-- name: CreateSession :exec
insert into sessions (token_hash, user_id, expires_at)
values (@token_hash, @user_id, @expires_at);

-- name: DeleteExpiredUserSessions :exec
delete from sessions
where user_id = @user_id and expires_at <= now();

-- Renova a expiração da sessão válida e devolve o usuário ativo dono dela.
-- name: TouchSession :one
with touched as (
    update sessions
    set last_seen_at = now(), expires_at = @expires_at
    where token_hash = @token_hash and expires_at > now()
    returning user_id, expires_at
)
select u.id, u.name, u.email, u.role, u.sector_id, touched.expires_at
from touched
join users u on u.id = touched.user_id
where u.active;

-- name: DeleteSession :exec
delete from sessions
where token_hash = @token_hash;

-- name: DeleteUserSessions :exec
delete from sessions
where user_id = @user_id;
