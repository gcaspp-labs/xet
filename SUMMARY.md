# Verificação run-20261122-120428

- Commit: `e1c4ddba6af78fe693870ed536313172dbd76dcb` (branch `ticket/375-exclusao-para-todos-celular`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-22 12:04:30 -0300
- Resumo gerado em: 2026-11-22 12:06:12 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | PASSOU | 7 | `evidence/atendimentos-message-revisions/` |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | PASSOU | 10 | `evidence/edit-delete-messages-chamados/` |
| edit-delete-sent-message | PASSOU | 9 | `evidence/edit-delete-sent-message/` |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | PASSOU | 7 | `evidence/message-revisions/` |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| exclusao-ampliada-para-todos (fora do mapa) | PASSOU | 6 | `evidence/exclusao-ampliada-para-todos/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

- atendimentos-message-revisions: [não coberto] Setor sem acesso (a API responde 403), temas claro e escuro e alto contraste, e a ordem completa de edições intercaladas entre o XET e o celular do setor (testes ponta a ponta em `frontend/e2e/atendimentos-message-changes.spec.ts` e `message-edit-delete.spec.ts`, e integração em `backend/internal/helpdesk/message_versions_test.go`).
- atendimentos-message-revisions: [manual] A mesma consulta depois de uma edição ou exclusão real recebida pelo Whatsmeow.
- close: [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- close: [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- close: [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).
- connection: [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- connection: [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- connection: [manual] Ler o QR code real com o celular do setor.
- connection: [manual] O QR code real trocando sozinho a cada 20 segundos.
- connection: [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- connection: [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- connection: [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.
- consult-closed-tickets: [não coberto] Paginação, ordem pelas demais colunas e correção do atendimento na ficha (`atendimentos.spec.ts`, `correction.spec.ts`).
- consult-closed-tickets: [não coberto] Abas Detalhes e Histórico da ficha e o chamado anterior de uma transferência (`ficha-atendimento.spec.ts`; o chamado anterior também está em `transfer`).
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Listar só os chamados próprios, ordenar por atividade e trocar de chamado (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- edit-delete-messages-chamados: [não coberto] Recusa e resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- edit-delete-messages-chamados: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- edit-delete-sent-message: [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- edit-delete-sent-message: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando à fila de Chamados sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Histórico dos chamados do contato, na ficha do atendimento (`ficha-atendimento.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- transfer: [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261122-120428/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 29 arquivo(s) em .verify-app/runs/run-20261122-120428/evidence.

## Detalhe de cada jornada

## Jornada atendimentos-message-revisions: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:37.653Z, duração 5 s.

#### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (869 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (517 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (49 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (360 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1667 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (203 ms)
7. ok: Estado final no banco (450 ms)

#### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":10,\"external_message_id\":\"VERIFY-937657714\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":11,\"external_message_id\":\"fake-msg-d762306c-e5e1-4d9b-bdaa-587823724b1d\",\"body\":\"*Atendente1 937654272:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 10:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 11:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 937654272:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 937654272:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:24.924Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (404 ms)
2. ok: Mensagem do cliente chega à fila (14 ms)
3. ok: Atendente assume e responde duas vezes (496 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (275 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (563 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (664 ms): `04-mensagem-editada.png`
7. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (531 ms): `05-janela-de-exclusao.png`
8. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (689 ms): `06-mensagem-ocultada.png`
9. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (350 ms): `07-alteracao-externa.png`
10. ok: Estado final no banco (191 ms)

#### Estado final observado

Mensagens do chamado:

```json
[
  {
    "body": "Preciso do boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "customer",
    "origin": "customer"
  },
  {
    "body": "*Atendente1 924925463:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 924925463:*\nMensagem enviada por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "origin": "agent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "kind": "edit",
    "status": "accepted"
  },
  {
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

## Jornada edit-delete-sent-message: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:31.038Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (588 ms)
2. ok: Mensagem do cliente chega à fila (41 ms)
3. ok: Atendente assume e responde (445 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (19 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (206 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (169 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (31 ms)
8. ok: Segunda mensagem é excluída só no XET (437 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (441 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 7,
    "body": "*Atendente1 931039596:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 8,
    "body": "*Atendente1 931039596:*\nMensagem por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "status": "sent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "message_id": 7,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 7,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 7,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 8,
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

Versões e exclusão da primeira (message_changes):

```json
[
  {
    "kind": "original",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "edit",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "deletion",
    "origin": "agent",
    "deletion_scope": "everyone"
  }
]
```

Auditoria:

```json
[
  {
    "entity_id": 7,
    "action": "message_edited"
  },
  {
    "entity_id": 7,
    "action": "message_deleted"
  },
  {
    "entity_id": 8,
    "action": "message_deleted"
  }
]
```

## Jornada exclusao-ampliada-para-todos: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:16.922Z, duração 4 s.

#### Passos

1. ok: Preparar um atendimento com a mensagem do cliente e o responsável (732 ms)
2. ok: O responsável assume, envia a mensagem e a exclui para mim (878 ms): `01-excluida-para-mim-no-xet.png`
3. ok: O celular do setor exclui para todos: o aviso e a prévia continuam sem o conteúdo (347 ms): `02-chamados-mantem-o-aviso-do-xet.png`
4. ok: O chamado é encerrado (103 ms)
5. ok: Em Atendimentos, a janela de exclusão lista as duas, e a última vale "para todos" (590 ms): `03-atendimento-com-conteudo-preservado.png`, `04-janela-com-as-duas-exclusoes.png`
6. ok: Estado final no banco (231 ms)

#### Estado final observado

Mensagem depois da ampliação:

```json
{
  "deletion_scope": "everyone",
  "deletion_origin": "agent"
}
```

Histórico de alterações:

```json
[
  {
    "kind": "deletion",
    "origin": "agent",
    "deletion_scope": "local",
    "com_horario": true
  },
  {
    "kind": "deletion",
    "origin": "phone",
    "deletion_scope": "everyone",
    "com_horario": true
  }
]
```

## Jornada message-revisions: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:34.840Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (394 ms)
2. ok: Mensagem do cliente chega à fila (14 ms)
3. ok: Atendente assume e vê a mensagem original (276 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (147 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (248 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (236 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (298 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 9,
  "body": "Preciso do balancete de outubro",
  "edited": true,
  "deletion_scope": "everyone",
  "deletion_origin": "customer"
}
```

Versões e exclusão (message_changes):

```json
[
  {
    "kind": "edit",
    "origin": "customer",
    "body": "versão antiga atrasada"
  },
  {
    "kind": "original",
    "origin": "customer",
    "body": "Preciso do balancete de setembro"
  },
  {
    "kind": "edit",
    "origin": "customer",
    "body": "Preciso do balancete de outubro"
  },
  {
    "kind": "deletion",
    "origin": "customer",
    "body": null
  }
]
```

Chamados do setor:

```json
[
  {
    "status": "in_progress"
  }
]
```
