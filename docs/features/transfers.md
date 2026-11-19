# Transferências

Passar o chamado para outra pessoa do setor, devolvê-lo à fila ou levá-lo a outro setor, sem perder o histórico.

## Regras

1. A transferência muda o responsável e preserva mensagens, registros e contexto, com registro no histórico.
2. Transfere o chamado em atendimento o próprio responsável. Supervisores do setor e administradores também transferem chamados de outros atendentes; o atendente que não é o responsável não transfere.
3. O destino é um atendente ou supervisor ativo do setor do chamado. Administradores não são destino.
4. Chamado na fila não é transferido: é assumido.
5. Depois da transferência, só o novo responsável responde; o anterior passa a ver a conversa apenas para leitura.
6. A conversa mostra, entre as mensagens e na ordem do tempo, quando o chamado foi assumido, cada transferência e o encerramento, com quem fez, de quem para quem e quando.
7. Transferir de novo para quem já é o responsável não muda nada nem gera novo registro.
8. O responsável, os supervisores do setor e os administradores devolvem à fila um chamado em atendimento, por exemplo quando foi assumido por engano.
9. A devolução fica registrada no histórico e aparece na conversa. O momento em que o chamado foi assumido pela primeira vez não muda.
10. Transfere para outro setor só o responsável pelo chamado em atendimento; supervisores e administradores também precisam ser o responsável. A transferência pede só o setor de destino e um motivo opcional (texto livre): não há formulário de encerramento e o contato não precisa estar cadastrado.
11. *(Removida em 18/11/2026; o número não é reutilizado.)*
12. A etapa do setor de origem é encerrada, e cria-se um chamado novo, ligado ao anterior, na fila do setor de destino.
13. O destino é outro setor ativo. Se o contato já tiver chamado aberto no destino, a transferência é recusada e nada é encerrado.
14. O novo chamado entra na fila do destino com o mesmo contato e o órgão principal dele (sem órgão, chega sem), e chega no momento da transferência. Se o contato não for cadastrado, o destino o cadastra ao encerrar (ver [closing.md](closing.md)).
15. O destino responde pelo próprio número de WhatsApp. A mensagem de abertura sai quando o chamado for assumido, não na transferência, e o atendente do destino a escreve livremente.
16. O chamado do destino mostra a origem (setor, protocolo, quem transferiu e o motivo, quando houver), com acesso ao chamado anterior completo (link "Ver chamado anterior", que abre `/atendimentos/:id`), só para leitura. Assunto e resolução aparecem só nas transferências antigas, feitas com o formulário.
17. Os usuários do destino veem toda a cadeia de chamados anteriores, mas não agem neles.
18. O chamado de origem mostra para qual setor e protocolo foi transferido, sem acesso ao chamado do destino. A conversa da origem mostra quem transferiu, quando e o motivo, quando houver. O aviso na conversa do destino ("transferiu do setor A para o setor B") também mostra o motivo.
19. A etapa de origem transferida não tem assunto, resolução e módulos nas transferências novas. Chamado transferido não tem correção, nem nas transferências antigas feitas com o formulário (ver [closing.md](closing.md)). Em Atendimentos ela aparece como Transferido, com o setor de destino.
20. No Dashboard, o tempo médio de atendimento da etapa transferida vai de quando foi assumida até o momento da transferência (ver [dashboard.md](dashboard.md)).
21. O motivo fica registrado na auditoria da transferência.

## Aviso de mensagem

Ao transferir para um atendente ou outro setor, se a última mensagem de saída do setor falhou ou ainda está sendo enviada, a janela avisa sem impedir a transferência. Mensagens recebidas não contam; mensagens enviadas, entregues ou lidas não geram aviso. Devolver à fila não mostra esse aviso.

## Fora do escopo / limites conhecidos

- Com a API oficial, a primeira mensagem do destino fora da janela de 24 horas precisará ser um modelo aprovado (ver `docs/architecture.md`).

## Relacionado

- Dados: `tickets` (`previous_ticket_id`, `transfer_reason`), `audit_logs` (`ticket_transferred_user`, `ticket_transferred_sector`, `ticket_returned`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Transferências › Entre atendentes do mesmo setor; Transferências › Devolver à fila; Transferências › Entre setores).
- 2026-11-14: o link da regra 16 passa a "Ver chamado anterior", só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)).
- 2026-11-15: regras 16 e 17 alteradas; spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PRs [#189](https://github.com/gcaspp-labs/xet/pull/189), [#190](https://github.com/gcaspp-labs/xet/pull/190), [#192](https://github.com/gcaspp-labs/xet/pull/192). A 16 dizia "O chamado do destino mostra a origem (setor, protocolo, assunto, resolução e quem transferiu), com acesso ao chamado anterior completo (link "Ver chamado anterior"), com notas, só para leitura."; a 17, "Os usuários do destino veem toda a cadeia de chamados anteriores, mas não escrevem notas nem agem neles.".
- 2026-11-18: regra 11 removida, regras 10, 14, 16 e 18 alteradas, regras 19 a 21 acrescentadas; spec [#243](https://github.com/gcaspp-labs/xet/issues/243), PRs [#250](https://github.com/gcaspp-labs/xet/pull/250), [#251](https://github.com/gcaspp-labs/xet/pull/251), [#252](https://github.com/gcaspp-labs/xet/pull/252), [#253](https://github.com/gcaspp-labs/xet/pull/253), [#255](https://github.com/gcaspp-labs/xet/pull/255). A 10 terminava em "...precisam ser o responsável."; a 11 dizia "Antes de concluir, preenche-se o formulário de encerramento completo (assunto, resolução e módulos), com as regras dele, inclusive o cadastro do contato (ver closing.md)."; a 14, "...com o mesmo contato e o órgão informado no formulário, e chega no momento da transferência."; a 16, "O chamado do destino mostra a origem (setor, protocolo, assunto, resolução e quem transferiu), com acesso ao chamado anterior completo (link \"Ver chamado anterior\", que abre `/atendimentos/:id`), só para leitura."; a 18 terminava em "A conversa da origem mostra quem transferiu e quando."
