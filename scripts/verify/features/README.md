# Mapa de fluxos do xet

O que a skill `verify-app` sabe percorrer, e como cada fluxo foi coberto. A regra de negócio está em `docs/features/`; aqui está o caminho para ver a regra funcionando.

## Quem é quem

- **Setor:** tem um número de WhatsApp próprio e uma fila. A visão é restrita ao setor.
- **Atendente:** assume chamados da fila e responde aos que estão com ele.
- **Supervisor:** faz o mesmo e, no próprio setor, conecta o número, transfere e devolve chamados de outras pessoas.
- **Administrador:** cadastra setores e usuários e vê todos os setores. Nas jornadas, só prepara os dados.
- **Chamado:** o atendimento de um contato num setor, com a conversa pelo WhatsApp. Situação no banco: `queued` (fila), `in_progress` (em atendimento) ou `closed`. Só há um aberto por contato e setor.
- **Contato:** a pessoa do outro lado. Número desconhecido vira contato não cadastrado, e o cadastro é exigido para encerrar.

## Fluxos

| Fluxo              | Arquivo                                        | Jornada              | Regras em `docs/features/`                     | Testes parecidos em `frontend/e2e`                              | Rode quando a mudança tocar em                                            |
| ------------------ | ---------------------------------------------- | -------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Menu Chamados | [conversas-menu.md](conversas-menu.md) | `conversas-menu` | `queue.md` | `conversas.spec.ts` | acesso à tela Chamados pelo menu |
| Receber e assumir  | [receive-and-assign.md](receive-and-assign.md) | `receive-and-assign` | `queue.md`                                     | `conversas.spec.ts`, `conversation.spec.ts`                     | fila de Chamados, assumir, tempo real, recepção de mensagens              |
| Responder          | [reply.md](reply.md)                           | `reply`              | `conversation.md`                              | `conversation.spec.ts`, `media.spec.ts`                         | tela da conversa, envio, situação da mensagem, anexos                     |
| Consultar assuntos | [consult-subjects.md](consult-subjects.md)     | `consult-subjects`   | `subjects.md`                                  | `subjects.spec.ts`                                              | consulta de assuntos durante o atendimento                                |
| Transferir         | [transfer.md](transfer.md)                     | `transfer`           | `transfers.md`                                 | `transfer.spec.ts`, `transfer-sector.spec.ts`, `return.spec.ts` | transferência, responsável, auditoria do chamado                          |
| Encerrar           | [close.md](close.md)                           | `close`              | `closing.md`, `subjects.md`, `cancellation.md` | `closing.spec.ts`, `correction.spec.ts`                         | formulário, histórico, cancelamento, cadastro de contato no encerramento  |
| Conexão            | [connection.md](connection.md)                 | `connection`         | `connection.md`, `notifications.md`            | `connection.spec.ts`                                            | tela de conexão, QR code, avisos de desconexão, adaptador de mensageria   |
| Consultar chamados em Atendimentos | [consult-closed-tickets.md](consult-closed-tickets.md) | `consult-closed-tickets` | `queue.md`, `interface.md` | `atendimentos.spec.ts`, `ficha-atendimento.spec.ts` | histórico de chamados encerrados, busca, filtros, ordem, ficha só leitura |
| Mesclado no atendimento | [mesclado-no-atendimento.md](mesclado-no-atendimento.md) | `mesclado-no-atendimento` | `queue.md` | `atendimentos.spec.ts`, `ficha-atendimento.spec.ts` | lista de Atendimentos, situação Mesclado, ficha do mesclado, link para o original |
| Chamado pendente e retomada | [pendente-retomada.md](pendente-retomada.md) | `pendente-retomada` | `queue.md`, `dashboard.md` (spec #332) | `pendente.spec.ts`, `mesclar-em-pendente.spec.ts` | aba Pendentes, quadro do Dashboard, aviso de pendentes, janela Retomar chamado, mesclagem em Atendimentos |
| Mesclar encerrado em pendente | [mesclar-encerrado-em-pendente.md](mesclar-encerrado-em-pendente.md) | `mesclar-encerrado-em-pendente` | `closing.md`, `queue.md` (spec #332) | `mesclar-em-pendente.spec.ts`, `correction.spec.ts` | ficha do atendimento encerrado, botão Mesclar em pendente, janela, destino do encerrado mesclado |
| Endereços finais | [final-routes.md](final-routes.md) | `final-routes` | `interface.md` | `rotas.spec.ts` | rotas, Não encontrado, redirecionamento de encerrados |
| Editar e excluir mensagem enviada | [edit-delete-sent-message.md](edit-delete-sent-message.md) | `edit-delete-sent-message` | `conversation.md`, `access.md`, `queue.md` | `conversation.spec.ts` | edição e exclusão pelo responsável, contrato de mensageria, ocultação local |
| Edições e exclusões externas | [message-revisions.md](message-revisions.md) | `message-revisions` | `conversation.md`, `queue.md` | `reactions.spec.ts` | eventos de edição e exclusão do provedor, versões de mensagem, estado de exclusão |
| Editar e excluir mensagens em Chamados | [edit-delete-messages-chamados.md](edit-delete-messages-chamados.md) | `edit-delete-messages-chamados` | `conversation.md`, `queue.md`, `interface.md` | `message-edit-delete.spec.ts` | menu da mensagem, compositor com "Editando", janela de exclusão, etiquetas e aviso de conteúdo ocultado |
| Versões e exclusões em Atendimentos | [atendimentos-message-revisions.md](atendimentos-message-revisions.md) | `atendimentos-message-revisions` | `queue.md`, `conversation.md` | `atendimentos-message-changes.spec.ts` | ficha só leitura de encerrados, versões de mensagem, exclusão pelo XET e externa, conteúdo preservado |

## Mudanças de navegação

Leia esta seção só quando o diff mexer em rotas, links, parâmetros da URL, `location.state` ou num botão de voltar. Antes de pedir revisão, ligue cada item que se aplica a um teste de `frontend/e2e/` ou a um passo de jornada. O que não se aplica, diga por quê. Não é preciso tirar print de toda rota.

| Item | O que conferir | Testes que já cobrem |
| --- | --- | --- |
| Pontos de entrada | Cada caminho que leva à tela: menu, link, linha da lista, endereço digitado | `rotas.spec.ts` (Chamados, `/atendimentos/:id`, Não encontrado), `dashboard.spec.ts` (a linha inteira abre o chamado), `atendimentos.spec.ts` (clicar na linha abre a ficha) |
| Mudança de query | `?pagina=`, `?ordem=`, `?direcao=`, `?busca=` e filtros vão para o endereço sem perder o resto da URL nem o `location.state` | `directory.spec.ts` (contatos e órgãos em páginas de 20), `atendimentos.spec.ts` (ordem e página no endereço), `dashboard.spec.ts` (filtros) |
| Transições aninhadas | Lista ou histórico → chamado → outro histórico → outro chamado, e a volta passo a passo até a origem | `history-return.spec.ts` (Contatos → histórico do contato → chamado → histórico do órgão → outro chamado; "Voltar ao histórico" volta ao histórico do órgão e, depois de fechá-lo, ao histórico de origem: a cadeia corrigida na PR #176, `frontend/src/lib/history-return.ts`), `rotas.spec.ts` (aba Histórico da ficha aponta para `/atendimentos/:id`) |
| Destino do Voltar | A seta da tela e o voltar do navegador levam aonde a pessoa estava, com a mesma página, ordem e busca | `rotas.spec.ts` (encerrado troca o histórico; sem acesso, a seta volta a Atendimentos; Não encontrado com Voltar), `atendimentos.spec.ts` (voltar mantém a busca), `directory.spec.ts` (voltar mantém página e ordem), `dashboard.spec.ts` (voltar depois de abrir pela linha) |
| Recarregar | Recarregar ou reabrir o endereço mostra o mesmo estado | `atendimentos.spec.ts` (página e filtro sobrevivem ao recarregar), `directory.spec.ts` (a ordem escolhida em contatos e em órgãos continua a mesma depois de recarregar; a busca continua no campo; reabrir o endereço com o filtro de órgão restaura o filtro), `dashboard.spec.ts` (filtros sobrevivem ao recarregar) |

`return.spec.ts` trata de **devolver o chamado à fila**, não do botão de voltar. Não conta como cobertura de navegação.

## Como ler o estado de uma sub-feature

Cada arquivo lista as sub-features com uma destas marcas, e o `evidence.sh` copia as duas últimas para o resumo:

- `[jornada]`: a jornada percorre e confere. Só vale como provado se ela tiver passado **nesta** execução.
- `[manual]`: depende do WhatsApp real. Fica para a verificação manual, com número de teste, e nunca conta como provado aqui. A situação geral está em `docs/pilot-validation.md`.
- `[não coberto]`: dá para percorrer com o adaptador falso, mas a jornada ainda não faz. Hoje só os testes automatizados citados cobrem.

## Partes do app fora deste mapa

Nenhuma jornada percorre estas partes, e a verificação não diz nada sobre elas: login e troca de senha (`auth.spec.ts`), administração de setores e usuários (`admin.spec.ts`), órgãos e contatos e a importação de contatos (`directory.spec.ts`), iniciar conversa (`start-conversation.spec.ts`), mídias recebidas e áudio gravado (`media.spec.ts`), correção de encerrados (`correction.spec.ts`), tema e menu lateral (`theme.spec.ts`, `sidebar.spec.ts`).

Se a mudança tocar numa delas, escreva a jornada antes de dizer que verificou.

## Como acrescentar um fluxo

1. Crie `<nome>.md` aqui, com as seções Sub-features, How to get to it, Driving it, Gotchas e Estado final observável.
2. Crie `../journeys/<nome>.mjs`, com o mesmo nome. O resumo liga os dois pelo nome.
3. Acrescente a linha na tabela acima.
4. Rode a jornada e olhe as capturas antes de dar por pronta. Passar não basta: a tela precisa mostrar o que o passo diz.
5. Faça a jornada falhar uma vez, exigindo um texto que não existe, para confirmar que ela sabe reprovar.
