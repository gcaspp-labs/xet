# Cancelamento

Finaliza um chamado sem lançar o atendimento, para spam, golpes e engano.

## Regras

1. Cancelar finaliza o chamado sem lançar o atendimento. Dispensa o formulário de encerramento, o cadastro do contato e o órgão.
2. Na fila, qualquer pessoa do setor cancela, sem assumir. Em atendimento, cancelam o responsável, os supervisores do setor e os administradores.
3. O motivo é um texto livre opcional. A conversa mostra quem cancelou e quando e, quando houver motivo, o motivo. Na fila, o X do chamado cancela direto, depois de uma confirmação no próprio item, sem motivo; a janela do menu ⋯ também salva com o motivo vazio (ticket [#395](https://github.com/gcaspp-labs/xet/issues/395)).
4. O chamado cancelado fica no histórico, identificado como cancelado, e não é corrigido nem reaberto.
5. Uma nova mensagem do mesmo número abre outro chamado, como após um encerramento.

## Fora do escopo / limites conhecidos

- Nenhum registrado.

## Relacionado

- Dados: `tickets` (`closure_type = 'cancelled'`), `audit_logs` (`ticket_cancelled`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Cancelamento).
- 2026-11-15: regra 4 alterada; spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PRs [#189](https://github.com/gcaspp-labs/xet/pull/189), [#190](https://github.com/gcaspp-labs/xet/pull/190). Dizia "O chamado cancelado fica no histórico, identificado como cancelado, e não é corrigido nem reaberto. Notas internas continuam permitidas.".
- 2026-11-23: regra 3 alterada (o motivo passa a ser opcional; o X da fila cancela sem motivo, com confirmação no próprio item); ticket [#395](https://github.com/gcaspp-labs/xet/issues/395). Dizia "O motivo é um texto livre obrigatório. A conversa mostra quem cancelou, quando e o motivo.".
