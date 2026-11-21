# Verificação run-20261121-050953

Commit: d3fb805848ecd31c32bd2e10cebed3ccc990c425.

- Commit: `d3fb805848ecd31c32bd2e10cebed3ccc990c425` (branch `ticket/323-receber-contato-whatsapp`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-21 05:09:55 -0300
- Resumo gerado em: 2026-11-21 05:10:38 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| contact-card-received (fora do mapa) | PASSOU | 6 | `evidence/contact-card-received/` |

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
- Log: `.verify-app/runs/run-20261121-050953/logs/backend.log`

## Detalhe de cada jornada

## Jornada consult-closed-tickets: PASSOU

Commit `d3fb805848ecd31c32bd2e10cebed3ccc990c425`, início 2026-11-21T08:10:25.075Z, duração 9 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2616 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (421 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1710 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (468 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (317 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1356 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (253 ms)

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

## Jornada contact-card-received: PASSOU

Commit `d3fb805848ecd31c32bd2e10cebed3ccc990c425`, início 2026-11-21T08:10:11.669Z, duração 2 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (466 ms)
2. ok: Contato antigo, gravado como não suportado, chega primeiro (118 ms)
3. ok: Cliente envia três contatos de uma vez; a fila mostra como hoje (110 ms): `01-fila-com-contato.png`
4. ok: Reentrega do mesmo contato não duplica (124 ms)
5. ok: Atendente assume e vê a mensagem como não suportada (344 ms): `02-conversa-com-contato.png`
6. ok: Estado final: API e banco com os cartões, antigo sem mudança (231 ms)

#### Estado final observado

API: cartões da mensagem contact:

```json
[
  {
    "name": "João Silva",
    "organization": "Prefeitura de Itu",
    "phones": [
      {
        "phone": "5511977776666",
        "whatsAppId": "5511977776666"
      },
      {
        "phone": "1140221000",
        "whatsAppId": null
      }
    ]
  },
  {
    "name": "Maria da Contabilidade",
    "organization": null,
    "phones": [
      {
        "phone": "5521966665555",
        "whatsAppId": null
      }
    ]
  },
  {
    "name": "Pedro Souza",
    "organization": null,
    "phones": []
  }
]
```

API: lastMessage do chamado:

```json
{
  "type": "contact",
  "body": null,
  "origin": "customer",
  "sentAt": "2026-11-21T05:10:13.132903-03:00",
  "hidden": false,
  "contactName": "João Silva"
}
```

Banco: mensagens do chamado:

```json
[
  {
    "external_message_id": "VERIFY-323-OLD",
    "type": "unsupported",
    "body": null,
    "contact_cards": null
  },
  {
    "external_message_id": "VERIFY-323-CT",
    "type": "contact",
    "body": null,
    "contact_cards": [
      {
        "name": "João Silva",
        "phones": [
          {
            "phone": "5511977776666",
            "wa_id": "5511977776666"
          },
          {
            "phone": "1140221000",
            "wa_id": null
          }
        ],
        "organization": "Prefeitura de Itu"
      },
      {
        "name": "Maria da Contabilidade",
        "phones": [
          {
            "phone": "5521966665555",
            "wa_id": null
          }
        ],
        "organization": null
      },
      {
        "name": "Pedro Souza",
        "phones": [],
        "organization": null
      }
    ]
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `d3fb805848ecd31c32bd2e10cebed3ccc990c425`, início 2026-11-21T08:10:18.926Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (633 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (127 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (181 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (132 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (230 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (323 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (170 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (287 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (184 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (322 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1076 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (589 ms)

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
  "protocol": "2026-000002",
  "status": "in_progress",
  "assignee": "Atendente1 618927152",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 618927152"
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

## #323: não provado nesta execução

- [manual] Contato real (um e vários) enviado de um celular e lido pelo Whatsmeow: o vCard real só é provado com número de teste. A leitura do vCard está coberta por `TestContactsBecomeNeutralCards` (whatsmeow_test), com vCards montados como o WhatsApp Web envia.
- [não coberto pela jornada] Contato enviado pelo celular do setor: o falso não expõe "enviada por fora" por HTTP; coberto por `TestReceivedContactIsRecordedWithItsCards` (integração).
- Jornada `contact-card-received` é provisória (fora do mapa), só para esta PR.

## Erros no log

Nenhum (`level=error` e `panic`: 0 em todos os logs da execução).
