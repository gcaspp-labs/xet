-- +goose Up
-- Canal do chamado e registro por telefone (#316, spec #311, docs/data-model.md).
-- Só acréscimo: os chamados existentes ficam com o padrão WhatsApp, sem mudar
-- mais nada neles. O registro por telefone nasce e fica encerrado, e a chave
-- de idempotência da tela impede que o duplo clique crie dois registros.
create type ticket_channel as enum ('whatsapp', 'phone');

alter table tickets
    add column channel ticket_channel not null default 'whatsapp',
    add column client_request_id uuid,
    add constraint tickets_phone_closed
        check (channel <> 'phone' or (status = 'closed' and closure_type = 'resolved'));

create unique index tickets_client_request_id_key on tickets (client_request_id)
    where client_request_id is not null;

-- +goose Down
-- Falha se já houver registro por telefone: apagá-lo perderia atendimentos.
-- +goose StatementBegin
do $$
begin
    if exists (select 1 from tickets where channel = 'phone') then
        raise exception 'há registros por telefone; a coluna de canal não pode ser removida';
    end if;
end $$;
-- +goose StatementEnd

drop index tickets_client_request_id_key;

alter table tickets
    drop constraint tickets_phone_closed,
    drop column client_request_id,
    drop column channel;

drop type ticket_channel;
