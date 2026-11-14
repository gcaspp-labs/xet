-- +goose Up
-- Apaga de vez os dados de Nota interna e "Falou com" (#173, #175). Os usos já
-- saíram do código na #174. O apagamento não tem volta: faça backup do banco
-- antes de rodar em produção.

-- Correção cuja única alteração era spoke_with fica sem nada a mostrar: apaga o registro.
delete from audit_logs
where action = 'ticket_corrected'
  and jsonb_exists(changes, 'spoke_with')
  and changes - 'spoke_with' = '{}'::jsonb;

-- Nas demais correções, tira só a chave spoke_with; motivo e outras alterações ficam.
update audit_logs
set changes = changes - 'spoke_with'
where action = 'ticket_corrected'
  and jsonb_exists(changes, 'spoke_with');

drop table internal_notes;
alter table tickets drop column spoke_with;

-- +goose Down
-- Só recria as estruturas, vazias, como nas migrações 00007 e 00006. Os dados
-- apagados na subida não voltam.
alter table tickets add column spoke_with text;

create table internal_notes (
    id bigint generated always as identity primary key,
    ticket_id bigint not null references tickets (id),
    author_id bigint not null references users (id),
    body text not null check (btrim(body) <> ''),
    created_at timestamptz not null default now()
);

create index internal_notes_ticket_id_idx on internal_notes (ticket_id, created_at);
