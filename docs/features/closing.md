# Encerramento e correções

O formulário que registra cada atendimento ao finalizar e a correção posterior dos dados, sempre com auditoria.

## Regras

1. Ao clicar em finalizar, abre-se o formulário de registro. O chamado só é encerrado depois de salvar os dados necessários. O registro por telefone é a exceção: a janela "Registrar atendimento por telefone" (ver [queue.md](queue.md)) tem os mesmos campos, com o contato escolhido na busca, e já cria o chamado encerrado ao salvar.
2. Encerra o chamado em atendimento somente o responsável; supervisores e administradores também precisam ser o responsável. Na ausência dele, o supervisor transfere o chamado para si e encerra.
3. Chamado na fila não é encerrado: é assumido.
4. O formulário tem os campos da tabela abaixo. Assunto, resolução e ao menos um módulo são obrigatórios.
5. O fim não pode ser anterior ao início nem estar no futuro. Sem edição, o fim é o momento em que o formulário é salvo.
6. O órgão sugerido é o do chamado ou, se ele ainda não tiver, o órgão principal do contato.
7. Contato não cadastrado precisa ser cadastrado e vinculado a um órgão antes de salvar o formulário.
8. Os módulos selecionáveis são os ativos do setor do chamado. O módulo do contato nesse setor, se ativo, já vem marcado, e a pessoa pode alterar ou marcar outros para aquele chamado.
9. Um chamado pode tratar de vários módulos, com uma resolução geral.
10. O momento em que o chamado foi assumido é registrado à parte, para medir o tempo de espera na fila.
11. Alterações nos horários ficam registradas na auditoria. O intervalo entre início e fim é o tempo decorrido do atendimento; como há atendimentos simultâneos, não representa necessariamente trabalho exclusivo naquele cliente.
12. Os assuntos e as soluções do formulário vêm das listas dos módulos marcados no chamado (ver [subjects.md](subjects.md)).
13. Chamados encerrados não são reabertos, nem o registro por telefone. Uma mensagem nova depois do encerramento cria outro chamado (ver [queue.md](queue.md)).
14. Os dados de um atendimento encerrado são corrigidos pelo atendente que o encerrou e pelos supervisores e administradores do setor. Os demais atendentes não corrigem. Atendimento transferido para outro setor não é corrigido, nem o antigo, feito com o formulário, e o mesclado num pendente também não.
15. A correção altera os dados do formulário (assunto, resolução, módulos, órgão, início e fim), com as mesmas regras do encerramento.
16. Módulos que já estavam no chamado podem continuar nele mesmo que tenham sido desativados depois; módulos acrescentados na correção precisam estar ativos no setor.
17. A correção exige um motivo. Uma correção que não altera nenhum dado é recusada, sem registro.
18. O sistema registra autor, data, motivo e as alterações (valores anteriores e novos). O chamado mostra o histórico de alterações nos detalhes, e a conversa mostra, na ordem do tempo, quem corrigiu e quando.
19. Ao encerrar, se a última mensagem de saída do setor falhou ou ainda está sendo enviada, o formulário avisa sem impedir o encerramento. Mensagens recebidas não contam; o aviso vem antes do aviso de contato não cadastrado. Mensagens enviadas, entregues ou lidas não geram aviso. Cancelar chamado não mostra esse aviso.

20. Na ficha de um atendimento encerrado ou cancelado, a ação Mesclar em pendente fica ao lado de Corrigir, para as mesmas pessoas que podem corrigir (regra 14), e só aparece quando o contato tem pelo menos um pendente no setor que já tinha começado quando o atendimento terminou. A janela lista esses pendentes (protocolo, motivo, quem marcou e desde quando), pede confirmar ou cancelar e não pede motivo de correção; se a lista esvaziar com a janela aberta, porque o pendente foi retomado ou mesclado em outro atendimento, o botão de mesclar fica desabilitado. Não há mesclagem de registro por telefone, de atendimento transferido, de atendimento já mesclado nem de pendente de outro contato ou setor; o pendente precisa continuar pendente até a confirmação, senão a mesclagem é recusada e nada muda.
21. Confirmada, as mensagens do atendimento passam para o pendente (com anexos, reações, versões e exclusões, mantendo os horários), e o pendente passa a Encerrado ou Cancelado com os dados do atendimento: assunto, resolução, módulos, órgão, responsável, horários de encerramento e, no cancelado, o motivo do cancelamento. O atendimento mesclado fica registrado como Mesclado, com o link "Ver chamado <protocolo>" do pendente, e a ficha dele passa a mostrar só esse aviso, sem conversa e sem correção; a conversa do pendente mostra o aviso "<quem> mesclou o atendimento <protocolo> neste chamado". A mesclagem não é desfeita, e o pendente encerrado continua corrigível pelas regras de correção, com o responsável herdado. Nos números, o atendimento mesclado sai de Encerrados (ou Cancelados) e do tempo médio, e o pendente entra no lugar, na data de encerramento dele (ver [dashboard.md](dashboard.md), regra 11).

## Campos do formulário

| Campo | Comportamento |
| --- | --- |
| Módulos/sistemas | Seleção de um ou mais módulos atendidos pelo setor; ao menos um obrigatório |
| Assunto | Escolhido na lista dos módulos marcados ou digitado; obrigatório; nenhum vem marcado |
| Resolução | Preenchida pelo atendente, a partir de uma solução da lista ou digitada; obrigatória |
| Contato | Automático |
| Órgão | Automático, com base no órgão principal do contato; editável |
| Atendente | Automático, com base no responsável |
| Setor | Automático |
| Início | Automático: chegada da primeira mensagem do cliente ou, em chamado aberto pelo atendente, envio da primeira mensagem; editável. No registro por telefone, informado, vindo com o horário de agora |
| Fim | Preenchido automaticamente e editável |

## Fora do escopo / limites conhecidos

- Cancelamentos não passam pelo formulário nem são corrigidos (ver [cancellation.md](cancellation.md)).

## Relacionado

- Dados: `tickets`, `ticket_modules`, `audit_logs` (`ticket_closed`, `ticket_corrected`, `ticket_phone_registered`, `ticket_merged`, `ticket_closed_by_merge`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Formulário de encerramento; Encerramento, retorno e correções).
- 2026-11-14: campo Início passa a dizer "chamado aberto" em vez de "conversa iniciada" (padronização dos nomes: Chamados, Atendimentos; #185). Só texto.
- 2026-11-15: regra 15 alterada, sem o "falou com"; spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PRs [#189](https://github.com/gcaspp-labs/xet/pull/189), [#190](https://github.com/gcaspp-labs/xet/pull/190). Dizia "A correção altera os dados do formulário (assunto, resolução, módulos, órgão, início e fim) e o "falou com", com as mesmas regras do encerramento.". O histórico de alterações antigo também deixa de mostrar o "falou com" (regra 18 sem mudança).
- 2026-11-18: regra 14 alterada; spec [#243](https://github.com/gcaspp-labs/xet/issues/243), PR [#252](https://github.com/gcaspp-labs/xet/pull/252). Terminava em "Os demais atendentes não corrigem.".
- 2026-11-18: regra 12 alterada e campo Módulos/sistemas passa a vir antes de Assunto na tabela; spec [#149](https://github.com/gcaspp-labs/xet/issues/149), PR [#156](https://github.com/gcaspp-labs/xet/pull/156). A regra dizia "vêm das listas do setor".
- 2026-11-22: regras 1 e 13 alteradas e o campo Início da tabela (o registro por telefone já nasce encerrado, e o início é informado nele); spec [#311](https://github.com/gcaspp-labs/xet/issues/311), PRs [#349](https://github.com/gcaspp-labs/xet/pull/349) e [#354](https://github.com/gcaspp-labs/xet/pull/354). A regra 1 terminava em "O chamado só é encerrado depois de salvar os dados necessários."; a 13 dizia "Chamados encerrados não são reabertos."; o campo Início dizia "Automático: chegada da primeira mensagem do cliente ou, em chamado aberto pelo atendente, envio da primeira mensagem; editável".
- 2026-11-25: regra 14 alterada (o mesclado num pendente não é corrigido) e regras 20 e 21 acrescentadas (Mesclar em pendente e o efeito da mesclagem); spec [#332](https://github.com/gcaspp-labs/xet/issues/332), tickets [#341](https://github.com/gcaspp-labs/xet/issues/341), [#343](https://github.com/gcaspp-labs/xet/issues/343), [#440](https://github.com/gcaspp-labs/xet/issues/440) e [#448](https://github.com/gcaspp-labs/xet/issues/448), PRs [#401](https://github.com/gcaspp-labs/xet/pull/401), [#446](https://github.com/gcaspp-labs/xet/pull/446), [#465](https://github.com/gcaspp-labs/xet/pull/465) e [#473](https://github.com/gcaspp-labs/xet/pull/473). A regra 14 terminava em "Atendimento transferido para outro setor não é corrigido, nem o antigo, feito com o formulário.".
