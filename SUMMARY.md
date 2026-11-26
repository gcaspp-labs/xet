# Verificação run-20261125-235155

- Commit: `1f319abd65aee3c5bcca663fdb833cbb047b9c90` (branch `ticket/451-jornadas-queuerowof`)
- Arquivos sem commit na subida: 1
- Início: 2026-11-25 23:51:56 -0300
- Resumo gerado em: 2026-11-25 23:52:47 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | PASSOU | 13 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| mesclado-no-atendimento | NÃO PROVADO: não percorrido nesta execução | 0 | |
| mesclar-encerrado-em-pendente | PASSOU | 9 | `evidence/mesclar-encerrado-em-pendente/` |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pendente-retomada | PASSOU | 9 | `evidence/pendente-retomada/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
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

- Linhas de erro no log do backend: 3, sendo 3 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261125-235155/logs/backend.log`

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:08.375Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (500 ms)
2. ok: Atendente assume o chamado (279 ms)
3. ok: Formulário vazio não encerra e diz o que falta (367 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (858 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (557 ms)
6. ok: Fim antes do início é recusado (159 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (720 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (83 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (372 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (323 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelar pelo X da fila, com a confirmação no item e sem motivo, dispensa o cadastro (885 ms): `08-cancelamento-confirmar.png`, `09-cancelado-no-historico.png`, `10-cancelado-sem-motivo.png`
12. ok: A janela de cancelamento salva com o motivo opcional (1024 ms): `11-cancelamento-motivo-opcional.png`
13. ok: Estado final do encerramento no banco (227 ms)

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
  "organization": "Prefeitura 528377578",
  "closed_by": "Atendente1 528376812",
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
    "actor": "Atendente1 528376812"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 528376812"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 528376812"
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

## Jornada mesclar-encerrado-em-pendente: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:39.312Z, duração 6 s.

#### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (543 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (798 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (308 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (1001 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (712 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (312 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (451 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (238 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (349 ms)

#### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 559314876",
  "closed_by": "Atendente1 559313141",
  "merged_into_ticket_id": null,
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 13,
  "messages": 0
}
```

Auditoria do pendente, do encerramento e da mesclagem:

```json
[
  {
    "ticket_id": 13,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 17,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 13,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 17
      }
    },
    "reason": "Aguardando o órgão confirmar o número antigo do protocolo"
  },
  {
    "ticket_id": 14,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 17,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 14,
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
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "module_ids": {
        "to": [
          3
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
    "ticket_id": 14,
    "action": "ticket_merged",
    "changes": {
      "subject": {
        "to": null,
        "from": "Comprovante de férias"
      },
      "module_ids": {
        "to": [],
        "from": [
          3
        ]
      },
      "resolution": {
        "to": null,
        "from": "Comprovante enviado por e-mail, a pedido da servidora."
      },
      "message_ids": {
        "to": [
          16
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": "resolved"
      },
      "merged_into_ticket_id": {
        "to": 13,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 13,
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
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "module_ids": {
        "to": [
          3
        ],
        "from": null
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      },
      "assignee_id": {
        "to": 17,
        "from": null
      },
      "closed_by_id": {
        "to": 17,
        "from": null
      },
      "closure_type": {
        "to": "resolved",
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000014",
        "from": null
      },
      "merged_ticket_id": {
        "to": 14,
        "from": null
      }
    },
    "reason": null
  }
]
```

## Jornada pendente-retomada: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:33.547Z, duração 5 s.

#### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (405 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (907 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (218 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (379 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (337 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (688 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (251 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (567 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (339 ms)

#### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 553547671",
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 11,
  "messages": 0
}
```

Auditoria do pendente e da mesclagem:

```json
[
  {
    "ticket_id": 11,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 15,
        "from": null
      }
    }
  },
  {
    "ticket_id": 11,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 15
      }
    }
  },
  {
    "ticket_id": 12,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 15,
        "from": null
      }
    }
  },
  {
    "ticket_id": 12,
    "action": "ticket_merged",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-26T02:52:37.617559Z",
        "from": null
      },
      "message_ids": {
        "to": [
          14
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": null
      },
      "merged_into_ticket_id": {
        "to": 11,
        "from": null
      }
    }
  },
  {
    "ticket_id": 11,
    "action": "ticket_resumed_by_merge",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "pending"
      },
      "assignee_id": {
        "to": 15,
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000012",
        "from": null
      },
      "merged_ticket_id": {
        "to": 12,
        "from": null
      }
    }
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:16.689Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (577 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (117 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (176 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (137 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (233 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (303 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (159 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (271 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (211 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (325 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1036 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (554 ms)

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
  "protocol": "2026-000005",
  "status": "in_progress",
  "assignee": "Atendente1 536690919",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 536690919"
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

## Jornada transfer: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:22.582Z, duração 11 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (966 ms)
2. ok: Atendente assume o chamado (233 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (344 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1004 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (264 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (19 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (941 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (228 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (282 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1287 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (841 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (216 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (398 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (1015 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (115 ms)

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
  "assignee": "Atendente1 542583563",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 542583563",
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
    "actor": "Atendente1 542583563",
    "changes": {
      "assignee_id": {
        "to": 11,
        "from": 10
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 542583563",
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
    "sector": "Setor 542583563",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 542584032",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 9,
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
        "to": "2026-11-26T02:52:29.711692Z",
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
        "to": 10,
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
  "previous_ticket_id": 9
}
```
