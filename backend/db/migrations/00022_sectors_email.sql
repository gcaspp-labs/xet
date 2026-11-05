-- +goose Up
-- E-mail universal do setor (modelo-dados.md): opcional e único sem diferenciar
-- maiúsculas. Os setores existentes ficam sem e-mail.
alter table sectors add column email text;

create unique index sectors_email_key on sectors (lower(email));

-- +goose Down
drop index sectors_email_key;

alter table sectors drop column email;
