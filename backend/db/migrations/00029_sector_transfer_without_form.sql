-- +goose Up
-- Transferência entre setores sem o formulário de encerramento (#243,
-- docs/data-model.md): a etapa de origem encerra como transferida sem órgão,
-- assunto e resolução, e guarda o motivo opcional. As transferências antigas,
-- com esses campos, continuam válidas.
alter table tickets
    add column transfer_reason text,
    add constraint tickets_transfer_reason_not_blank
        check (transfer_reason is null or btrim(transfer_reason) <> '');

alter table tickets drop constraint tickets_closed_fields;
alter table tickets add constraint tickets_closed_fields check (
    status <> 'closed' or (
        ended_at is not null and closed_at is not null
        and closed_by_id is not null and closure_type is not null
        and (
            closure_type in ('cancelled', 'transferred')
            or (organization_id is not null and subject is not null and resolution is not null)
        )
    )
);

-- +goose Down
-- Volta a exigir o formulário nas transferências: falha se já houver
-- transferência sem ele.
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

alter table tickets
    drop constraint tickets_transfer_reason_not_blank,
    drop column transfer_reason;
