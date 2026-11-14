# Encerramento e correções

O formulário que registra cada atendimento ao finalizar e a correção posterior dos dados, sempre com auditoria.

## Regras

1. Ao clicar em finalizar, abre-se o formulário de registro. O chamado só é encerrado depois de salvar os dados necessários.
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
12. Os assuntos e as soluções do formulário vêm das listas do setor (ver [subjects.md](subjects.md)).
13. Chamados encerrados não são reabertos. Uma mensagem nova depois do encerramento cria outro chamado (ver [queue.md](queue.md)).
14. Os dados de um atendimento encerrado são corrigidos pelo atendente que o encerrou e pelos supervisores e administradores do setor. Os demais atendentes não corrigem.
15. A correção altera os dados do formulário (assunto, resolução, módulos, órgão, início e fim) e o "falou com", com as mesmas regras do encerramento.
16. Módulos que já estavam no chamado podem continuar nele mesmo que tenham sido desativados depois; módulos acrescentados na correção precisam estar ativos no setor.
17. A correção exige um motivo. Uma correção que não altera nenhum dado é recusada, sem registro.
18. O sistema registra autor, data, motivo e as alterações (valores anteriores e novos). O chamado mostra o histórico de alterações nos detalhes, e a conversa mostra, na ordem do tempo, quem corrigiu e quando.

## Campos do formulário

| Campo | Comportamento |
| --- | --- |
| Assunto | Escolhido na lista do setor ou digitado; obrigatório; nenhum vem marcado |
| Resolução | Preenchida pelo atendente, a partir de uma solução da lista ou digitada; obrigatória |
| Módulos/sistemas | Seleção de um ou mais módulos atendidos pelo setor; ao menos um obrigatório |
| Contato | Automático |
| Órgão | Automático, com base no órgão principal do contato; editável |
| Atendente | Automático, com base no responsável |
| Setor | Automático |
| Início | Automático: chegada da primeira mensagem do cliente ou, em chamado aberto pelo atendente, envio da primeira mensagem; editável |
| Fim | Preenchido automaticamente e editável |

## Fora do escopo / limites conhecidos

- Cancelamentos não passam pelo formulário nem são corrigidos (ver [cancellation.md](cancellation.md)).

## Relacionado

- Dados: `tickets`, `ticket_modules`, `audit_logs` (`ticket_closed`, `ticket_corrected`).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Formulário de encerramento; Encerramento, retorno e correções).
