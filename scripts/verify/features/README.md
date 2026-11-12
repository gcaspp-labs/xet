# Mapa de fluxos do xet

O que a skill `verify-app` sabe percorrer, e como cada fluxo foi coberto. A regra de negócio está em `docs/features/`; aqui está o caminho para ver a regra funcionando.

## Quem é quem

- **Setor:** tem um número de WhatsApp próprio e uma fila. A visão é restrita ao setor.
- **Atendente:** assume chamados da fila e responde aos que estão com ele.
- **Supervisor:** faz o mesmo e, no próprio setor, conecta o número, transfere e devolve chamados de outras pessoas.
- **Administrador:** cadastra setores e usuários e vê todos os setores. Nas jornadas, só prepara os dados.
- **Chamado:** uma conversa com um contato num setor. Situação no banco: `queued` (fila), `in_progress` (em atendimento) ou `closed`. Só há um aberto por contato e setor.
- **Contato:** a pessoa do outro lado. Número desconhecido vira contato não cadastrado, e o cadastro é exigido para encerrar.

## Fluxos

| Fluxo              | Arquivo                                        | Jornada              | Regras em `docs/features/`                     | Testes parecidos em `frontend/e2e`                              | Rode quando a mudança tocar em                                            |
| ------------------ | ---------------------------------------------- | -------------------- | ---------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Menu Conversas | [conversas-menu.md](conversas-menu.md) | `conversas-menu` | `queue.md` | `conversas.spec.ts` | acesso à tela Conversas pelo menu |
| Receber e assumir  | [receive-and-assign.md](receive-and-assign.md) | `receive-and-assign` | `queue.md`                                     | `panel.spec.ts`, `conversation.spec.ts`                         | fila, painel, assumir, tempo real, recepção de mensagens                  |
| Responder          | [reply.md](reply.md)                           | `reply`              | `conversation.md`                              | `conversation.spec.ts`, `media.spec.ts`                         | tela da conversa, envio, situação da mensagem, anexos                     |
| Consultar assuntos | [consult-subjects.md](consult-subjects.md)     | `consult-subjects`   | `subjects.md`                                  | `subjects.spec.ts`                                              | consulta de assuntos durante o atendimento                                |
| Transferir         | [transfer.md](transfer.md)                     | `transfer`           | `transfers.md`                                 | `transfer.spec.ts`, `transfer-sector.spec.ts`, `return.spec.ts` | transferência, responsável, auditoria do chamado                          |
| Encerrar           | [close.md](close.md)                           | `close`              | `closing.md`, `subjects.md`, `cancellation.md` | `closing.spec.ts`, `correction.spec.ts`                         | formulário, realizados, cancelamento, cadastro de contato no encerramento |
| Conexão            | [connection.md](connection.md)                 | `connection`         | `connection.md`, `notifications.md`            | `connection.spec.ts`                                            | tela de conexão, QR code, avisos de desconexão, adaptador de mensageria   |

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
