# Verificação run-20261125-211711

- Commit: `c90ec44f1844d4e1d773a517ab4d908374f1f63a` (branch `ticket/456-verify-lint-expectstatus`)
- Arquivos sem commit na subida: 3
- Início: 2026-11-25 21:17:13 -0300
- Resumo gerado em: 2026-11-25 21:24:41 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | PASSOU | 7 | `evidence/atendimentos-message-revisions/` |
| close | PASSOU | 13 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| edit-delete-messages-chamados | PASSOU | 11 | `evidence/edit-delete-messages-chamados/` |
| edit-delete-sent-message | PASSOU | 9 | `evidence/edit-delete-sent-message/` |
| final-routes | PASSOU | 6 | `evidence/final-routes/` |
| mesclado-no-atendimento | PASSOU | 6 | `evidence/mesclado-no-atendimento/` |
| mesclar-encerrado-em-pendente | PASSOU | 9 | `evidence/mesclar-encerrado-em-pendente/` |
| message-revisions | PASSOU | 7 | `evidence/message-revisions/` |
| pendente-retomada | PASSOU | 9 | `evidence/pendente-retomada/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | PASSOU | 15 | `evidence/transfer/` |

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
- edit-delete-messages-chamados: [não coberto] Resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- edit-delete-messages-chamados: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- edit-delete-sent-message: [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- edit-delete-sent-message: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- mesclar-encerrado-em-pendente: [não coberto] O atendimento cancelado também mescla, herdando o motivo do cancelamento no registro de A: fica nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts`.
- mesclar-encerrado-em-pendente: [não coberto] A corrida de alguém retomar o pendente escolhido antes da mesclagem, e as recusas (transferido, já mesclado, sem permissão de correção, sem pendente do contato): também nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts` e nos testes do backend.
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
- pendente-retomada: [não coberto] Recusas (retomar sem permissão, pendente de outro contato ou setor, chamado devolvido à fila antes do retomar) e a atualização ao vivo para quem só assiste: ficam nos testes de `frontend/e2e/pendente.spec.ts`.
- pendente-retomada: [não coberto] Aviso de pendentes no sino de notificações, que está fora do escopo da spec #332.
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

- Linhas de erro no log do backend: 2, sendo 2 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261125-211711/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 127 arquivo(s) em .verify-app/runs/run-20261125-211711/evidence.

## Detalhe de cada jornada

## Jornada atendimentos-message-revisions: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:24.130Z, duração 5 s.

#### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (898 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (498 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (57 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (434 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1835 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (215 ms)
7. ok: Estado final no banco (449 ms)

#### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":1,\"external_message_id\":\"VERIFY-484134583\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":2,\"external_message_id\":\"fake-msg-76e0f3bd-91dd-49e9-90da-967f7dc40880\",\"body\":\"*Atendente1 484131652:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 1:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 2:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 484131652:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 484131652:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```

## Jornada close: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:29.708Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (445 ms)
2. ok: Atendente assume o chamado (227 ms)
3. ok: Formulário vazio não encerra e diz o que falta (402 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (729 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (473 ms)
6. ok: Fim antes do início é recusado (91 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (677 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (91 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (338 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (283 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (936 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (1099 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (235 ms)

#### Estado final observado

Chamado cancelado pelo X, sem motivo:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": null,
  "contact_registered": false
}
```

Chamado cancelado pela janela, sem motivo:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": null
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 489709142",
  "closed_by": "Atendente1 489708982",
  "has_closed_at": true,
  "end_after_start": true,
  "modules": "Folha, Patrimônio"
}
```

Auditoria do encerramento:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 489708982"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 489708982"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 489708982"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 3,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:37.661Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (367 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (422 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (269 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (317 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (309 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (310 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1017 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (606 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (822 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (224 ms)

#### Estado final observado

Atendente tentando conectar pela API:

```json
{
  "http": 403
}
```

Setor:

```json
{
  "connection_status": "logged_out",
  "phone": null,
  "external_account_id": null
}
```

Auditoria da conexão:

```json
[
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": null
  },
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": "Supervisor 497661226"
  }
]
```

## Jornada consult-closed-tickets: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:43.571Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2359 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (363 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1806 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (387 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (247 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1413 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (249 ms)

#### Estado final observado

Chamados encerrados do setor (banco):

```json
"[{\"closure_type\":\"transferred\",\"has_closed_at\":true},{\"closure_type\":\"cancelled\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true}]"
```

Chamados abertos do setor, fora da lista (banco):

```json
"[{\"n\":1}]"
```

Filtro de situação na API:

```json
"HTTP 400"
```

Setor de outro, para atendente:

```json
"HTTP 403"
```

## Jornada consult-subjects: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:52.154Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (445 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (419 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (363 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (197 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (656 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (204 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 512155175:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:55.625Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (403 ms)
2. ok: Abrir Chamados pelo menu (182 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1575 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (106 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:21:59.158Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (409 ms)
2. ok: Mensagem do cliente chega à fila (32 ms)
3. ok: Atendente assume e responde duas vezes (650 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (267 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (584 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (614 ms): `04-mensagem-editada.png`
7. ok: Recusa do WhatsApp: aviso, texto preservado e faixa aberta (688 ms): `05-recusa-do-whatsapp.png`
8. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (550 ms): `06-janela-de-exclusao.png`
9. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (843 ms): `07-mensagem-ocultada.png`
10. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (315 ms): `08-alteracao-externa.png`
11. ok: Estado final no banco (221 ms)

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
    "body": "*Atendente1 519159673:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 519159673:*\nMensagem enviada por engano",
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
    "kind": "edit",
    "status": "refused"
  },
  {
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

## Jornada edit-delete-sent-message: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:06.392Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (551 ms)
2. ok: Mensagem do cliente chega à fila (12 ms)
3. ok: Atendente assume e responde (503 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (22 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (279 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (154 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (19 ms)
8. ok: Segunda mensagem é excluída só no XET (645 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (451 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 21,
    "body": "*Atendente1 526393036:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 22,
    "body": "*Atendente1 526393036:*\nMensagem por engano",
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
    "message_id": 21,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 21,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 21,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 22,
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
    "entity_id": 21,
    "action": "message_edited"
  },
  {
    "entity_id": 21,
    "action": "message_deleted"
  },
  {
    "entity_id": 22,
    "action": "message_deleted"
  }
]
```

## Jornada final-routes: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:10.458Z, duração 4 s.

#### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (772 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (836 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (401 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (450 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (322 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (111 ms)

#### Estado final observado

Chamados do setor (banco):

```json
[
  {
    "status": "closed",
    "closure_type": "resolved"
  },
  {
    "status": "queued",
    "closure_type": null
  }
]
```

## Jornada mesclado-no-atendimento: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:14.535Z, duração 3 s.

#### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (819 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (318 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (244 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (353 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (208 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (250 ms)

#### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":19}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```

## Jornada mesclar-encerrado-em-pendente: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:17.870Z, duração 5 s.

#### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (563 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (867 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (281 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (976 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (703 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (267 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (361 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (216 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (349 ms)

#### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 537872013",
  "closed_by": "Atendente1 537871459",
  "merged_into_ticket_id": null,
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 21,
  "messages": 0
}
```

Auditoria do pendente, do encerramento e da mesclagem:

```json
[
  {
    "ticket_id": 21,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 29,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 21,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 29
      }
    },
    "reason": "Aguardando o órgão confirmar o número antigo do protocolo"
  },
  {
    "ticket_id": 22,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 29,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 22,
    "action": "ticket_closed",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "subject": {
        "to": "Comprovante de férias",
        "from": null
      },
      "ended_at": {
        "to": "2026-11-26T00:22:21.199603Z",
        "from": null
      },
      "module_ids": {
        "to": [
          9
        ],
        "from": []
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 22,
    "action": "ticket_merged",
    "changes": {
      "subject": {
        "to": null,
        "from": "Comprovante de férias"
      },
      "module_ids": {
        "to": [],
        "from": [
          9
        ]
      },
      "resolution": {
        "to": null,
        "from": "Comprovante enviado por e-mail, a pedido da servidora."
      },
      "message_ids": {
        "to": [
          28
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": "resolved"
      },
      "merged_into_ticket_id": {
        "to": 21,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 21,
    "action": "ticket_closed_by_merge",
    "changes": {
      "status": {
        "to": "closed",
        "from": "pending"
      },
      "subject": {
        "to": "Comprovante de férias",
        "from": null
      },
      "ended_at": {
        "to": "2026-11-26T00:22:21.199603Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-26T00:22:21.199603Z",
        "from": null
      },
      "module_ids": {
        "to": [
          9
        ],
        "from": null
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      },
      "assignee_id": {
        "to": 29,
        "from": null
      },
      "closed_by_id": {
        "to": 29,
        "from": null
      },
      "closure_type": {
        "to": "resolved",
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000022",
        "from": null
      },
      "merged_ticket_id": {
        "to": 22,
        "from": null
      }
    },
    "reason": null
  }
]
```

## Jornada message-revisions: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:23.600Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (387 ms)
2. ok: Mensagem do cliente chega à fila (24 ms)
3. ok: Atendente assume e vê a mensagem original (262 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (153 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (321 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (253 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (342 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 29,
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

## Jornada pendente-retomada: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:26.468Z, duração 5 s.

#### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (401 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (827 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (196 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (321 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (300 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (659 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (215 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (535 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (347 ms)

#### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 546468498",
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 24,
  "messages": 0
}
```

Auditoria do pendente e da mesclagem:

```json
[
  {
    "ticket_id": 24,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 33,
        "from": null
      }
    }
  },
  {
    "ticket_id": 24,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 33
      }
    }
  },
  {
    "ticket_id": 25,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 33,
        "from": null
      }
    }
  },
  {
    "ticket_id": 25,
    "action": "ticket_merged",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-26T00:22:30.357678Z",
        "from": null
      },
      "message_ids": {
        "to": [
          31
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": null
      },
      "merged_into_ticket_id": {
        "to": 24,
        "from": null
      }
    }
  },
  {
    "ticket_id": 24,
    "action": "ticket_resumed_by_merge",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "pending"
      },
      "assignee_id": {
        "to": 33,
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000025",
        "from": null
      },
      "merged_ticket_id": {
        "to": 25,
        "from": null
      }
    }
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:31.975Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (551 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (120 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (175 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (138 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (248 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (255 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (175 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (291 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (216 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (314 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1052 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (600 ms)

#### Estado final observado

Disputa simultânea: respostas HTTP e auditoria:

```json
{
  "respostas": [
    200,
    409
  ],
  "registrosDeAuditoria": 1
}
```

Outro setor pedindo o chamado pela API:

```json
{
  "http": 403
}
```

Chamado:

```json
{
  "protocol": "2026-000026",
  "status": "in_progress",
  "assignee": "Atendente1 551975625",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 551975625"
  }
]
```

Mensagens e chamados abertos do contato:

```json
{
  "mensagens": 2,
  "chamadosAbertos": 1
}
```

## Jornada reply: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:38.038Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (381 ms)
2. ok: Sem assumir, não há como responder (353 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (248 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (293 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (242 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (706 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (87 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (208 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (242 ms)
10. ok: Pela API, quem não é responsável também é recusado (263 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (362 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (330 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (264 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (112 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 37,
  "linhas": 1
}
```

Resposta indevida pela API:

```json
{
  "http": 403,
  "mensagensAlteradas": 0
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "origin": "customer",
    "type": "text",
    "status": null,
    "body": "Preciso do contracheque",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "read",
    "body": "*Atendente1 558039237:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 558039237:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 558039237:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 558039237:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:43.860Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (999 ms)
2. ok: Atendente assume o chamado (233 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (268 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (971 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (315 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (15 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (919 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (232 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (257 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1191 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (804 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (211 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (383 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (944 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (111 ms)

#### Estado final observado

Resposta do responsável anterior pela API:

```json
{
  "http": 403
}
```

Chamado transferido:

```json
{
  "status": "in_progress",
  "assignee": "Atendente1 563861591",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 563861591",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 42,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 563861591",
    "changes": {
      "assignee_id": {
        "to": 43,
        "from": 42
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 563861591",
    "changes": {
      "assignee_id": {
        "to": 42,
        "from": 43
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 563861591",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 563862898",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 31,
    "subject": null,
    "transfer_reason": null,
    "organization_id": null
  }
]
```

Auditoria da origem:

```json
[
  {
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 42,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_sector",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-26T00:22:50.805159Z",
        "from": null
      },
      "sector_id": {
        "to": 20,
        "from": 19
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 32,
        "from": null
      },
      "transfer_reason": {
        "to": "Folha de março é com o outro setor.",
        "from": null
      }
    }
  }
]
```

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 31
}
```
