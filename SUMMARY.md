# Verificação run-20261125-040108

- Commit: `cb364df16b7be5e35ce6c2195194f88cb17430d5` (branch `ticket/344-jornada-mesclar-encerrado`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-25 04:01:10 -0300
- Resumo gerado em: 2026-11-25 04:03:32 -0300
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
| edit-delete-messages-chamados | PASSOU | 10 | `evidence/edit-delete-messages-chamados/` |
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
- edit-delete-messages-chamados: [não coberto] Recusa e resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
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

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261125-040108/logs/backend.log`

## Detalhe de cada jornada

## Jornada atendimentos-message-revisions: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:19.048Z, duração 3 s.

#### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (541 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (280 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (25 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (172 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1205 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (210 ms)
7. ok: Estado final no banco (229 ms)

#### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":7,\"external_message_id\":\"VERIFY-139052518\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":8,\"external_message_id\":\"fake-msg-de4d9dad-cace-4377-a58d-3556ede40816\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 7:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 8:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```

## Jornada close: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:22.536Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (320 ms)
2. ok: Atendente assume o chamado (153 ms)
3. ok: Formulário vazio não encerra e diz o que falta (241 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (563 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (427 ms)
6. ok: Fim antes do início é recusado (85 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (444 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (52 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (233 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (204 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (619 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (719 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (114 ms)

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
  "organization": "Prefeitura 142538843",
  "closed_by": "Atendente1 142537350",
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
    "actor": "Atendente1 142537350"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 142537350"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 142537350"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 9,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:28.137Z, duração 4 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (238 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (273 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (154 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (264 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (280 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (318 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (840 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (385 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (592 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (113 ms)

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
    "actor": "Supervisor 148138163"
  }
]
```

## Jornada consult-closed-tickets: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:32.447Z, duração 6 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (1483 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (219 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1225 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (303 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (174 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1115 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (141 ms)

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

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:38.367Z, duração 2 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (311 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (282 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (228 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (133 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (441 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (114 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 158367121:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:40.726Z, duração 2 s.

#### Passos

1. ok: Preparar setor e atendente (266 ms)
2. ok: Abrir Chamados pelo menu (98 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1261 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (56 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:43.258Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (283 ms)
2. ok: Mensagem do cliente chega à fila (9 ms)
3. ok: Atendente assume e responde duas vezes (421 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (188 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (453 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (446 ms): `04-mensagem-editada.png`
7. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (401 ms): `05-janela-de-exclusao.png`
8. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (631 ms): `06-mensagem-ocultada.png`
9. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (199 ms): `07-alteracao-externa.png`
10. ok: Estado final no banco (113 ms)

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
    "body": "*Atendente1 163259746:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 163259746:*\nMensagem enviada por engano",
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

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:47.866Z, duração 2 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (336 ms)
2. ok: Mensagem do cliente chega à fila (15 ms)
3. ok: Atendente assume e responde (328 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (10 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (170 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (101 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (13 ms)
8. ok: Segunda mensagem é excluída só no XET (414 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (236 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 27,
    "body": "*Atendente1 167866231:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 28,
    "body": "*Atendente1 167866231:*\nMensagem por engano",
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
    "message_id": 27,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 27,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 27,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 28,
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
    "entity_id": 27,
    "action": "message_edited"
  },
  {
    "entity_id": 27,
    "action": "message_deleted"
  },
  {
    "entity_id": 28,
    "action": "message_deleted"
  }
]
```

## Jornada final-routes: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:50.525Z, duração 3 s.

#### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (496 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (542 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (284 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (337 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (214 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (58 ms)

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

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:53.298Z, duração 2 s.

#### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (484 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (230 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (183 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (230 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (122 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (118 ms)

#### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":25}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```

## Jornada mesclar-encerrado-em-pendente: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:55.610Z, duração 4 s.

#### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (329 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (586 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (154 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (699 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (469 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (216 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (258 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (151 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (186 ms)

#### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 175612533",
  "closed_by": "Atendente1 175611180",
  "merged_into_ticket_id": null,
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 27,
  "messages": 0
}
```

Auditoria do pendente, do encerramento e da mesclagem:

```json
[
  {
    "ticket_id": 27,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 35,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 27,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 35
      }
    },
    "reason": "Aguardando o órgão confirmar o número antigo do protocolo"
  },
  {
    "ticket_id": 28,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 35,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 28,
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
        "to": "2026-11-25T07:02:57.888681Z",
        "from": null
      },
      "module_ids": {
        "to": [
          11
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
    "ticket_id": 28,
    "action": "ticket_merged",
    "changes": {
      "subject": {
        "to": null,
        "from": "Comprovante de férias"
      },
      "module_ids": {
        "to": [],
        "from": [
          11
        ]
      },
      "resolution": {
        "to": null,
        "from": "Comprovante enviado por e-mail, a pedido da servidora."
      },
      "message_ids": {
        "to": [
          34
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": "resolved"
      },
      "merged_into_ticket_id": {
        "to": 27,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 27,
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
        "to": "2026-11-25T07:02:57.888681Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-25T07:02:57.888681Z",
        "from": null
      },
      "module_ids": {
        "to": [
          11
        ],
        "from": null
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      },
      "assignee_id": {
        "to": 35,
        "from": null
      },
      "closed_by_id": {
        "to": 35,
        "from": null
      },
      "closure_type": {
        "to": "resolved",
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000028",
        "from": null
      },
      "merged_ticket_id": {
        "to": 28,
        "from": null
      }
    },
    "reason": null
  }
]
```

## Jornada message-revisions: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:59.527Z, duração 2 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (256 ms)
2. ok: Mensagem do cliente chega à fila (17 ms)
3. ok: Atendente assume e vê a mensagem original (237 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (117 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (182 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (199 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (169 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 35,
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

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:03:01.621Z, duração 4 s.

#### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (259 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (626 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (139 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (290 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (192 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (460 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (147 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (354 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (180 ms)

#### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 181622104",
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 30,
  "messages": 0
}
```

Auditoria do pendente e da mesclagem:

```json
[
  {
    "ticket_id": 30,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 39,
        "from": null
      }
    }
  },
  {
    "ticket_id": 30,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 39
      }
    }
  },
  {
    "ticket_id": 31,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 39,
        "from": null
      }
    }
  },
  {
    "ticket_id": 31,
    "action": "ticket_merged",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-25T07:03:04.481118Z",
        "from": null
      },
      "message_ids": {
        "to": [
          37
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": null
      },
      "merged_into_ticket_id": {
        "to": 30,
        "from": null
      }
    }
  },
  {
    "ticket_id": 30,
    "action": "ticket_resumed_by_merge",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "pending"
      },
      "assignee_id": {
        "to": 39,
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000031",
        "from": null
      },
      "merged_ticket_id": {
        "to": 31,
        "from": null
      }
    }
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:03:05.512Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (360 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (56 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (121 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (68 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (137 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (203 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (114 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (137 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (123 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (194 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (685 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (293 ms)

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
  "protocol": "2026-000032",
  "status": "in_progress",
  "assignee": "Atendente1 185513031",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 185513031"
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

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:03:09.315Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (241 ms)
2. ok: Sem assumir, não há como responder (260 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (103 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (222 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (219 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (553 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (45 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (136 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (153 ms)
10. ok: Pela API, quem não é responsável também é recusado (126 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (300 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (249 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (219 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (60 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 43,
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
    "body": "*Atendente1 189316996:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 189316996:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 189316996:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 189316996:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:03:13.438Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (654 ms)
2. ok: Atendente assume o chamado (178 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (187 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (746 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (175 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (8 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (776 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (119 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (212 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (902 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (499 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (112 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (292 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (712 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (53 ms)

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
  "assignee": "Atendente1 193439182",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 193439182",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 48,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 193439182",
    "changes": {
      "assignee_id": {
        "to": 49,
        "from": 48
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 193439182",
    "changes": {
      "assignee_id": {
        "to": 48,
        "from": 49
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 193439182",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 193440591",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 37,
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
        "to": 48,
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
        "to": "2026-11-25T07:03:18.626292Z",
        "from": null
      },
      "sector_id": {
        "to": 23,
        "from": 22
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 38,
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
  "previous_ticket_id": 37
}
```
