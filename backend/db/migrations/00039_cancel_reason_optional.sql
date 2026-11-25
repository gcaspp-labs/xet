-- +goose Up
-- O motivo do cancelamento passa a ser opcional (#395): a janela do menu "Mais
-- ações" e o X da fila cancelam sem motivo, e a auditoria grava o motivo nulo
-- quando ninguém escreve. Correção e pendente continuam exigindo motivo.
-- docs/data-model.md.
alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action not in ('ticket_corrected', 'ticket_pending') or (reason is not null and btrim(reason) <> ''));

-- +goose Down
-- Falha se já houver cancelamento sem motivo: a regra antiga voltaria a exigir o
-- motivo que não existe, e o dado não pode ser inventado.
-- +goose StatementBegin
do $$
begin
    if exists (
        select 1 from audit_logs
        where action = 'ticket_cancelled' and (reason is null or btrim(reason) = '')
    ) then
        raise exception 'há cancelamentos sem motivo; a regra antiga não pode voltar sem preenchê-los';
    end if;
end $$;
-- +goose StatementEnd

alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action not in ('ticket_corrected', 'ticket_cancelled', 'ticket_pending') or (reason is not null and btrim(reason) <> ''));
