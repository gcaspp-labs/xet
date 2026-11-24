# Verificação run-20261124-122753

- Commit: `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42` (branch `ticket/338-aviso-pendentes-retomar`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-24 12:27:55 -0300
- Resumo gerado em: 2026-11-24 12:32:43 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | PASSOU | 15 | `evidence/transfer/` |
| retomar-pendente (fora do mapa) | PASSOU | 7 | `evidence/retomar-pendente/` |

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
- Log: `.verify-app/runs/run-20261124-122753/logs/backend.log`

## Detalhe de cada jornada

## Jornada receive-and-assign: PASSOU

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:28:32.505Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (375 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (74 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (130 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (69 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (137 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (211 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (126 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (151 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (135 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (226 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (690 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (278 ms)

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
  "protocol": "2026-000001",
  "status": "in_progress",
  "assignee": "Atendente1 112506066",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 112506066"
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

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:28:36.422Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (245 ms)
2. ok: Sem assumir, não há como responder (251 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (150 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (198 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (164 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (531 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (45 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (172 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (120 ms)
10. ok: Pela API, quem não é responsável também é recusado (117 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (317 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (250 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (252 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (61 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 6,
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
    "body": "*Atendente1 116423679:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 116423679:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 116423679:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 116423679:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada retomar-pendente: PASSOU

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:31:08.275Z, duração 2 s.

#### Passos

1. ok: Preparar um setor conectado, a atendente e o cliente na primeira mensagem (251 ms)
2. ok: Atendente assume e coloca o chamado como pendente (555 ms): `01-colocar-como-pendente.png`
3. ok: O cliente volta a escrever e o chamado novo mostra o aviso na fila, sem a ação (249 ms): `02-aviso-na-fila.png`
4. ok: Atendente assume o chamado novo e o aviso ganha a ação (211 ms): `03-aviso-em-atendimento.png`
5. ok: A janela Retomar chamado lista o pendente do contato (233 ms): `04-janela-retomar-chamado.png`
6. ok: O chamado original abre com as mensagens dos dois e o aviso da retomada (163 ms): `05-chamado-original-retomado.png`
7. ok: Estado final no banco: o original em atendimento e o novo mesclado nele (164 ms)

#### Estado final observado

Chamado original:

```json
[
  {
    "status": "in_progress",
    "assignee_id": 15,
    "pending_reason": "Aguardando a nota fiscal do serviço"
  }
]
```

Chamado novo mesclado:

```json
[
  {
    "status": "closed",
    "closure_type": "merged",
    "merged_into_ticket_id": 8
  }
]
```

Mensagens do original:

```json
[
  {
    "body": "Preciso da segunda via da guia",
    "ticket_id": 5
  },
  {
    "body": "Preciso da segunda via da guia",
    "ticket_id": 8
  },
  {
    "body": "Voltei com a nota fiscal",
    "ticket_id": 8
  }
]
```

## Jornada transfer: PASSOU

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:28:40.519Z, duração 7 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (626 ms)
2. ok: Atendente assume o chamado (172 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (208 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (731 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (215 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (7 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (887 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (108 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (171 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (811 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (538 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (108 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (236 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (600 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (52 ms)

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
  "assignee": "Atendente1 120520862",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 120520862",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 10,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 120520862",
    "changes": {
      "assignee_id": {
        "to": 11,
        "from": 10
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 120520862",
    "changes": {
      "assignee_id": {
        "to": 10,
        "from": 11
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 120520862",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 120521732",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 6,
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
        "to": 10,
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
        "to": "2026-11-24T15:28:45.583362Z",
        "from": null
      },
      "sector_id": {
        "to": 5,
        "from": 4
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 7,
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
  "previous_ticket_id": 6
}
```

## Comparação com o protótipo (#338)

Protótipo aprovado por Laboratório em 20/11/2026 (branch `prototype/338`).

- **Aviso, 1 pendente:** igual ao protótipo — faixa `Alert` de aviso no topo da conversa, com "Este contato tem 1 chamado pendente." e o botão **Retomar chamado** à direita do texto (na coluna estreita da conversa, o botão quebra para a linha de baixo, como no protótipo).
- **Aviso, na fila:** "Este contato tem 1 chamado pendente. Assuma o chamado para retomar o pendente.", sem a ação (`evidence/retomar-pendente/02-aviso-na-fila.png`).
- **Quem não é o responsável:** o aviso mostra a quantidade e "Só quem atende este chamado pode retomar o pendente.", sem a ação (coberto por e2e `pendente.spec.ts`; não percorrido na jornada).
- **Menu ⋯:** "Retomar chamado" é o primeiro item, antes de Devolver à fila, com separador depois (e2e `pendente.spec.ts`; a captura do menu ficou nos testes, não na jornada).
- **Janela Retomar chamado:** igual ao protótipo — título e texto de ajuda, "Chamado pendente deste contato", cartões com rádio (contato, protocolo, motivo, quem marcou e há quanto tempo), Cancelar e Retomar chamado.
- **Conversa do chamado original:** mensagens dos dois chamados na ordem do tempo e o registro "… retomou este chamado a partir do <protocolo do chamado novo>".

Sem diferença de cor, token ou estrutura em relação ao protótipo. A única diferença é a faixa "Contato não cadastrado" que já existia na conversa em atendimento, ao lado do aviso novo.

## Não provado

- WhatsApp real: nada aqui prova o envio ou o recebimento pelo Whatsmeow; o adaptador é o falso.
- A jornada `retomar-pendente` é provisória, fora do mapa: a jornada durável de pendente e mesclagem é a #340. A #338 não pede jornada nova.
- O erro do servidor na janela (alguém retomou o pendente antes) tem teste de integração no backend (`TestResumePending...`), não foi percorrido em tela.
