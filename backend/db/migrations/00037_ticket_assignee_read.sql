-- +goose Up
-- Momento até onde o responsável atual leu o chamado (#313, spec #310): as
-- mensagens recebidas do cliente gravadas depois dele são as não lidas. Fica
-- vazio na fila; assumir, receber por transferência entre atendentes e criar o
-- chamado pelo atendente gravam o momento, e devolver à fila limpa o valor.
-- Os chamados já em atendimento começam sem não lidas.
alter table tickets add column assignee_read_at timestamptz;

update tickets set assignee_read_at = now() where status = 'in_progress';

-- +goose Down
alter table tickets drop column assignee_read_at;
