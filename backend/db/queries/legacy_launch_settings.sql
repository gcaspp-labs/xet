-- name: GetLegacyLaunchSettings :one
select * from legacy_launch_settings
where id = 1;

-- name: UpdateLegacyLaunchSettings :one
-- Grava a configuração do automático: a chave, o contador de falhas seguidas e
-- a pausa (que sempre tem motivo junto).
update legacy_launch_settings
set automatic_enabled = @automatic_enabled,
    consecutive_failures = @consecutive_failures,
    paused_at = sqlc.narg('paused_at'),
    paused_reason = sqlc.narg('paused_reason'),
    updated_at = now()
where id = 1
returning *;

-- name: ResetLegacyLaunchPause :one
-- Zera a pausa e o contador de falhas seguidas, sem ligar nem desligar o
-- automático.
update legacy_launch_settings
set paused_at = null,
    paused_reason = null,
    consecutive_failures = 0,
    updated_at = now()
where id = 1
returning *;
