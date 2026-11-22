-- +goose Up
-- Chamado pendente e vínculo do mesclado (#333, spec #332, docs/data-model.md).
-- Os chamados existentes não mudam: as colunas novas nascem vazias, e as
-- restrições novas só alcançam os estados novos.
alter table tickets
    add column pending_reason text,
    add column pending_by_id bigint references users (id),
    add column pending_at timestamptz,
    add column merged_into_ticket_id bigint references tickets (id),
    add constraint tickets_pending_reason_not_blank
        check (pending_reason is null or btrim(pending_reason) <> ''),
    add constraint tickets_pending_fields
        check (status <> 'pending' or (pending_reason is not null and pending_by_id is not null and pending_at is not null)),
    add constraint tickets_merged_fields
        check ((closure_type is not distinct from 'merged') = (merged_into_ticket_id is not null)
               and (closure_type is distinct from 'merged' or (status = 'closed' and subject is null and resolution is null))),
    add constraint tickets_merged_into_other
        check (merged_into_ticket_id is distinct from id);

-- O pendente fica sem responsável atual, como a fila.
alter table tickets drop constraint tickets_queued_unassigned;
alter table tickets add constraint tickets_queued_unassigned
    check (status not in ('queued', 'pending') or assignee_id is null);
alter table tickets drop constraint tickets_assigned;
alter table tickets add constraint tickets_assigned
    check (status in ('queued', 'pending') or assignee_id is not null);

-- O mesclado, como o cancelado e o transferido, não exige órgão, assunto e
-- resolução.
alter table tickets drop constraint tickets_closed_fields;
alter table tickets add constraint tickets_closed_fields check (
    status <> 'closed' or (
        ended_at is not null and closed_at is not null
        and closed_by_id is not null and closure_type is not null
        and (
            closure_type in ('cancelled', 'transferred', 'merged')
            or (organization_id is not null and subject is not null and resolution is not null)
        )
    )
);

-- Um chamado na fila ou em atendimento por contato e setor: os pendentes
-- ficam fora, e o contato pode ter vários.
drop index tickets_open_contact_key;
create unique index tickets_open_contact_key on tickets (sector_id, contact_id)
    where status in ('queued', 'in_progress');

create index tickets_merged_into_ticket_id_idx on tickets (merged_into_ticket_id)
    where merged_into_ticket_id is not null;

-- O motivo do pendente fica também na auditoria, como o da correção e o do
-- cancelamento.
alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action not in ('ticket_corrected', 'ticket_cancelled', 'ticket_pending') or (reason is not null and btrim(reason) <> ''));

-- +goose Down
-- Falha se já houver pendente ou mesclado: desfazer perderia o estado deles.
-- +goose StatementBegin
do $$
begin
    if exists (select 1 from tickets where status = 'pending' or closure_type = 'merged') then
        raise exception 'há chamados pendentes ou mesclados; o estado pendente não pode ser removido';
    end if;
end $$;
-- +goose StatementEnd

alter table audit_logs drop constraint audit_logs_correction_reason;
alter table audit_logs add constraint audit_logs_correction_reason
    check (action not in ('ticket_corrected', 'ticket_cancelled') or (reason is not null and btrim(reason) <> ''));

drop index tickets_merged_into_ticket_id_idx;

drop index tickets_open_contact_key;
create unique index tickets_open_contact_key on tickets (sector_id, contact_id) where status <> 'closed';

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

alter table tickets drop constraint tickets_assigned;
alter table tickets add constraint tickets_assigned check (status = 'queued' or assignee_id is not null);
alter table tickets drop constraint tickets_queued_unassigned;
alter table tickets add constraint tickets_queued_unassigned check (status <> 'queued' or assignee_id is null);

alter table tickets
    drop constraint tickets_merged_into_other,
    drop constraint tickets_merged_fields,
    drop constraint tickets_pending_fields,
    drop constraint tickets_pending_reason_not_blank,
    drop column merged_into_ticket_id,
    drop column pending_at,
    drop column pending_by_id,
    drop column pending_reason;
