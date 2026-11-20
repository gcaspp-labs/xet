# Verificação run-20261120-082734

- Commit: `941c159e02a9d7e7d48577ac72fee95b4df004f1` (branch `ticket/293-chamados-editar-excluir-mensagens`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-20 08:27:36 -0300
- Resumo gerado em: 2026-11-20 08:31:24 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| edit-delete-messages-chamados | PASSOU | 10 | `evidence/edit-delete-messages-chamados/` |
| edit-delete-sent-message | PASSOU | 9 | `evidence/edit-delete-sent-message/` |
| final-routes | PASSOU | 6 | `evidence/final-routes/` |
| message-revisions | PASSOU | 7 | `evidence/message-revisions/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | PASSOU | 15 | `evidence/transfer/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

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
- Log: `/home/thiagocalazans/code/xet-implementer/.verify-app/runs/run-20261120-082734/logs/backend.log`

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:03.260Z, duração 10 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (1022 ms)
2. ok: Atendente assume o chamado (268 ms)
3. ok: Formulário vazio não encerra e diz o que falta (430 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (1051 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (595 ms)
6. ok: Fim antes do início é recusado (156 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (796 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (129 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (481 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (500 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1858 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (542 ms)

#### Estado final observado

Chamado cancelado:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": "Golpe do falso boleto.",
  "contact_registered": false
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 083261713",
  "closed_by": "Atendente1 083260635",
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
    "actor": "Atendente1 083260635"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 083260635"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 083260635"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 2,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:13.901Z, duração 8 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (769 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (616 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (306 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (388 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (490 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (416 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1162 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (1146 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (1255 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (523 ms)

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
    "actor": "Supervisor 093902773"
  }
]
```

## Jornada consult-closed-tickets: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:22.994Z, duração 13 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (5110 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (463 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (2161 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (599 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (409 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1737 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (529 ms)

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

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:36.676Z, duração 5 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (937 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (572 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (508 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (206 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (744 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (542 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 116677618:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:41.939Z, duração 4 s.

#### Passos

1. ok: Preparar setor e atendente (744 ms)
2. ok: Abrir Chamados pelo menu (193 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1881 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (287 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:46.947Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (858 ms)
2. ok: Mensagem do cliente chega à fila (27 ms)
3. ok: Atendente assume e responde duas vezes (680 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (423 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (658 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (733 ms): `04-mensagem-editada.png`
7. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (576 ms): `05-janela-de-exclusao.png`
8. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (862 ms): `06-mensagem-ocultada.png`
9. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (548 ms): `07-alteracao-externa.png`
10. ok: Estado final no banco (501 ms)

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
    "body": "*Atendente1 126948001:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 126948001:*\nMensagem enviada por engano",
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

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:55.886Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (1223 ms)
2. ok: Mensagem do cliente chega à fila (45 ms)
3. ok: Atendente assume e responde (549 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (30 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (330 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (195 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (33 ms)
8. ok: Segunda mensagem é excluída só no XET (621 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (1079 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 18,
    "body": "*Atendente1 135886023:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 19,
    "body": "*Atendente1 135886023:*\nMensagem por engano",
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
    "message_id": 18,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 18,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 18,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 19,
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
    "entity_id": 18,
    "action": "message_edited"
  },
  {
    "entity_id": 18,
    "action": "message_deleted"
  },
  {
    "entity_id": 19,
    "action": "message_deleted"
  }
]
```

## Jornada final-routes: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:02.358Z, duração 6 s.

#### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (1714 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (854 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (500 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (667 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (414 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (262 ms)

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

## Jornada message-revisions: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:08.432Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (847 ms)
2. ok: Mensagem do cliente chega à fila (34 ms)
3. ok: Atendente assume e vê a mensagem original (287 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (156 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (408 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (399 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (741 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 22,
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

## Jornada receive-and-assign: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:13.106Z, duração 9 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (1263 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (146 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (225 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (274 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (399 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (354 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (196 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (528 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (198 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (325 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1658 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (1370 ms)

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
  "protocol": "2026-000018",
  "status": "in_progress",
  "assignee": "Atendente1 153107828",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 153107828"
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

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:22.651Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (820 ms)
2. ok: Sem assumir, não há como responder (649 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (187 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (379 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (310 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (900 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (93 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (239 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (540 ms)
10. ok: Pela API, quem não é responsável também é recusado (566 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (498 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (574 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (320 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (270 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 28,
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
    "body": "*Atendente1 162651658:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 162651658:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 162651658:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 162651658:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:31.523Z, duração 15 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (2052 ms)
2. ok: Atendente assume o chamado (281 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (367 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1149 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (342 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (15 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1156 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (572 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (341 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1317 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (1136 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (532 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (591 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (1289 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (248 ms)

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
  "assignee": "Atendente1 171524162",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 171524162",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 34,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 171524162",
    "changes": {
      "assignee_id": {
        "to": 35,
        "from": 34
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 171524162",
    "changes": {
      "assignee_id": {
        "to": 34,
        "from": 35
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 171524162",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 171525619",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 23,
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
        "to": 34,
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
        "to": "2026-11-20T11:29:41.588374Z",
        "from": null
      },
      "sector_id": {
        "to": 16,
        "from": 15
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 24,
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
  "previous_ticket_id": 23
}
```
