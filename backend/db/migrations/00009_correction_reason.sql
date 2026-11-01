-- +goose Up
-- Correção de chamado encerrado sempre tem motivo (spec.md, Encerramento,
-- retorno e correções), mesmo que o código já confira.
alter table audit_logs add constraint audit_logs_correction_reason
    check (action <> 'ticket_corrected' or (reason is not null and btrim(reason) <> ''));

-- +goose Down
alter table audit_logs drop constraint audit_logs_correction_reason;
