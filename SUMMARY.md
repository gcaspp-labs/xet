# Verificação run-20261125-223020

- Commit: `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3` (branch `ticket/456-verify-lint-expectstatus`)
- Arquivos sem commit na subida: 1
- Início: 2026-11-25 22:30:21 -0300
- Resumo gerado em: 2026-11-25 22:36:41 -0300
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
| guarda-expectstatus (fora do mapa) | PASSOU | 2 | `evidence/guarda-expectstatus/` |

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

- Linhas de erro no log do backend: 5, sendo 5 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261125-223020/logs/backend.log`

## Detalhe de cada jornada

## Jornada atendimentos-message-revisions: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:30:38.233Z, duração 5 s.

#### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (862 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (468 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (56 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (337 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1573 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (204 ms)
7. ok: Estado final no banco (387 ms)

#### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":1,\"external_message_id\":\"VERIFY-638237984\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":2,\"external_message_id\":\"fake-msg-44951b81-4acc-48b4-a864-e9c1b677b611\",\"body\":\"*Atendente1 638234594:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 1:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 2:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 638234594:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 638234594:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```

## Jornada close: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:30:43.196Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (487 ms)
2. ok: Atendente assume o chamado (278 ms)
3. ok: Formulário vazio não encerra e diz o que falta (388 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (717 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (472 ms)
6. ok: Fim antes do início é recusado (130 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (610 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (115 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (353 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (270 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (857 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (1026 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (212 ms)

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
  "organization": "Prefeitura 643198181",
  "closed_by": "Atendente1 643197922",
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
    "actor": "Atendente1 643197922"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 643197922"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 643197922"
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:30:51.019Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (385 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (457 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (290 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (354 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (406 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (352 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (999 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (615 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (799 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (222 ms)

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
    "actor": "Supervisor 651019234"
  }
]
```

## Jornada consult-closed-tickets: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:30:57.113Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2345 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (413 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1672 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (408 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (292 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1232 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (258 ms)

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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:05.436Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (465 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (456 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (412 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (225 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (746 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (229 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 665437938:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:09.163Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (426 ms)
2. ok: Abrir Chamados pelo menu (192 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1558 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (125 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:12.614Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (381 ms)
2. ok: Mensagem do cliente chega à fila (12 ms)
3. ok: Atendente assume e responde duas vezes (511 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (268 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (548 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (613 ms): `04-mensagem-editada.png`
7. ok: Recusa do WhatsApp: aviso, texto preservado e faixa aberta (684 ms): `05-recusa-do-whatsapp.png`
8. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (546 ms): `06-janela-de-exclusao.png`
9. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (661 ms): `07-mensagem-ocultada.png`
10. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (362 ms): `08-alteracao-externa.png`
11. ok: Estado final no banco (219 ms)

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
    "body": "*Atendente1 672615505:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 672615505:*\nMensagem enviada por engano",
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:19.348Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (563 ms)
2. ok: Mensagem do cliente chega à fila (23 ms)
3. ok: Atendente assume e responde (432 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (19 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (209 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (142 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (20 ms)
8. ok: Segunda mensagem é excluída só no XET (481 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (438 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 21,
    "body": "*Atendente1 679348363:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 22,
    "body": "*Atendente1 679348363:*\nMensagem por engano",
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:23.039Z, duração 4 s.

#### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (828 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (821 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (379 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (510 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (270 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (108 ms)

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

## Jornada guarda-expectstatus: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:30:36.500Z, duração 1 s.

#### Passos

1. ok: expectStatus recusa código fora de 5xx na chamada (1 ms)
2. ok: filtro por caminho libera só a rota declarada (1225 ms): `01-filtro-por-caminho.png`

## Jornada mesclado-no-atendimento: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:27.169Z, duração 3 s.

#### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (817 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (338 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (226 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (335 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (197 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (190 ms)

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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:30.498Z, duração 5 s.

#### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (564 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (795 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (297 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (910 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (769 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (286 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (370 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (254 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (360 ms)

#### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 690500519",
  "closed_by": "Atendente1 690499861",
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
        "to": 31,
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
        "from": 31
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
        "to": 31,
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
        "to": "2026-11-26T01:31:33.748181Z",
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
        "to": "2026-11-26T01:31:33.748181Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-26T01:31:33.748181Z",
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
        "to": 31,
        "from": null
      },
      "closed_by_id": {
        "to": 31,
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:36.298Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (391 ms)
2. ok: Mensagem do cliente chega à fila (14 ms)
3. ok: Atendente assume e vê a mensagem original (301 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (133 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (259 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (238 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (357 ms)

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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:39.147Z, duração 5 s.

#### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (417 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (777 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (260 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (317 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (309 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (619 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (241 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (553 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (346 ms)

#### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 699148930",
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
        "to": 35,
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
        "from": 35
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
        "to": 35,
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
        "to": "2026-11-26T01:31:43.044037Z",
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
        "to": 35,
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:44.637Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (548 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (113 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (171 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (107 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (198 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (291 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (177 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (264 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (209 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (291 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1081 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (563 ms)

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
  "assignee": "Atendente1 704638205",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 704638205"
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

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:50.385Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (432 ms)
2. ok: Sem assumir, não há como responder (427 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (153 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (226 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (291 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (743 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (67 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (194 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (258 ms)
10. ok: Pela API, quem não é responsável também é recusado (252 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (378 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (324 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (290 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (105 ms)

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
    "body": "*Atendente1 710386548:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 710386548:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 710386548:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 710386548:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:56.369Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (925 ms)
2. ok: Atendente assume o chamado (217 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (293 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1050 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (249 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (15 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (948 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (231 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (240 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1134 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (782 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (224 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (376 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (1014 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (107 ms)

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
  "assignee": "Atendente1 716370202",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 716370202",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 44,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 716370202",
    "changes": {
      "assignee_id": {
        "to": 45,
        "from": 44
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 716370202",
    "changes": {
      "assignee_id": {
        "to": 44,
        "from": 45
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 716370202",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 716371484",
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
        "to": 44,
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
        "to": "2026-11-26T01:32:03.354643Z",
        "from": null
      },
      "sector_id": {
        "to": 21,
        "from": 20
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
