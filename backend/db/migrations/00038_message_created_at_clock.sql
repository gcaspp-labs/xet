-- +goose Up
-- O horário de gravação da mensagem passa a ser o instante do insert, não o do
-- início da transação (#313, spec #310). As não lidas comparam esse horário com
-- o da leitura do responsável, que também usa clock_timestamp(): com now(), uma
-- mensagem cuja transação já estava aberta quando a leitura foi gravada, mas que
-- só gravou depois dela, ficaria com horário anterior à leitura e nunca contaria
-- como não lida. Nenhum dado é migrado.
alter table messages alter column created_at set default clock_timestamp();

-- +goose Down
alter table messages alter column created_at set default now();
