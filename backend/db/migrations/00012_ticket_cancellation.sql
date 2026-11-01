-- +goose Up
-- Chamado cancelado dispensa órgão, assunto e resolução; o motivo é
-- obrigatório como na correção (spec.md, Cancelamento).
alter table tickets drop constraint tickets_closed_fields;
alter table tickets add constraint tickets_closed_fields check (
    status <> 'closed' or (
        ended_at is not null and closed_at is not null
        and closed_by_id is not null and closure_type is not null
        and (
            closure_type = 'cancelled'
            or (organization_id is not null and subject is not null and resolution is not null)
        )
    )
);

alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action not in ('ticket_corrected', 'ticket_cancelled') or (reason is not null and btrim(reason) <> ''));

-- +goose Down
alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action <> 'ticket_corrected' or (reason is not null and btrim(reason) <> ''));

alter table tickets drop constraint tickets_closed_fields;
alter table tickets add constraint tickets_closed_fields check (
    status <> 'closed' or (
        organization_id is not null and ended_at is not null and closed_at is not null
        and closed_by_id is not null and closure_type is not null
        and subject is not null and resolution is not null
    )
);
