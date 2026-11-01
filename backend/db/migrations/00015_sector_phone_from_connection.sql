-- +goose Up
-- O telefone do setor vem do número lido no QR code (modelo-dados.md, sectors).
-- O digitado em setor sem conta vinculada não foi lido de nenhum aparelho e
-- poderia bloquear o número certo em outro setor; o dos vinculados é
-- substituído na próxima conexão.
alter table sectors
    alter column phone drop not null,
    add column connection_error text;
update sectors set phone = null where external_account_id is null;

-- +goose Down
update sectors set phone = lpad(id::text, 15, '0') where phone is null;
alter table sectors
    alter column phone set not null,
    drop column connection_error;
