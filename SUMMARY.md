# Verificação run-20261104-175021

- Commit: `143e165648781335e66799e8cabbe825b85ddb61` (branch `task/47-api-do-dashboard-do-atendimento`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 17:50:23 -0300
- Resumo gerado em: 2026-11-04 17:54:33 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| dashboard-api (fora do mapa) | PASSOU | 11 | `evidence/dashboard-api/` |
| dashboard-return (fora do mapa) | PASSOU | 5 | `evidence/dashboard-return/` |

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
- receive-and-assign: [não coberto] Assumir pela lista da tela da conversa, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`panel.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`panel.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando ao painel sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Notas internas, "Falou com" e histórico do contato (`conversation.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir a conversa anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-175021/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 54 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-175021/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:24.553Z, duração 9 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (669 ms)
2. ok: Atendente assume o chamado (369 ms)
3. ok: Formulário vazio não encerra e diz o que falta (469 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (985 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (936 ms)
6. ok: Fim antes do início é recusado (166 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (577 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (123 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (471 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (381 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1138 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (269 ms)

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
  "organization": "Prefeitura 484554562",
  "closed_by": "Atendente1 484553460",
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
    "actor": "Atendente1 484553460"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 484553460"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 484553460"
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

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:33.696Z, duração 8 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (547 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (582 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (337 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (488 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (476 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (399 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1339 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (844 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (1195 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (277 ms)

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
    "actor": "Supervisor 493697330"
  }
]
```

## Jornada dashboard-api: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:14.188Z, duração 6 s.

#### Passos

1. ok: Preparar dois setores, módulos e um órgão (1688 ms)
2. ok: Gerar chamados pelas rotas do produto: fila, atendimento, iniciado, encerrado, cancelado e transferido (1163 ms)
3. ok: Supervisor vê os números do próprio setor, sem pedir o setor (246 ms): `01-resposta-do-supervisor.png`
4. ok: Tabela por atendente: responsável final e sem linhas zeradas (22 ms)
5. ok: Administrador vê todos os setores, e a transferência conta na origem e no destino (86 ms)
6. ok: Período: "agora" não muda; o que depende de data muda, e média sem dados vem vazia (56 ms)
7. ok: Filtros seguem a tabela da spec, com "não se aplica" (87 ms)
8. ok: Correção de módulos muda os números (75 ms)
9. ok: Opções do filtro de atendente (47 ms)
10. ok: Permissões e filtros inválidos são recusados (99 ms)
11. ok: Estado final no banco bate com os números da API (304 ms)

#### Estado final observado

Supervisor, hoje:

```json
{
  "queued": 1,
  "inProgress": 2,
  "received": 5,
  "started": 1,
  "resolved": 1,
  "transferred": 1,
  "cancelled": 1,
  "averageWaitSeconds": 1,
  "averageHandlingSeconds": 0
}
```

Tabela do setor:

```json
[
  {
    "nome": "Atendente1 474188357",
    "setor": "Setor 474188357",
    "inProgress": 2,
    "started": 1,
    "resolved": 1,
    "transferred": 0,
    "cancelled": 0
  },
  {
    "nome": "Atendente2 474188357",
    "setor": "Setor 474188357",
    "inProgress": 0,
    "started": 0,
    "resolved": 0,
    "transferred": 1,
    "cancelled": 1
  }
]
```

Administrador, todos os setores:

```json
{
  "queued": 2,
  "inProgress": 2,
  "received": 6,
  "started": 1,
  "resolved": 1,
  "transferred": 1,
  "cancelled": 1,
  "averageWaitSeconds": 1,
  "averageHandlingSeconds": 0
}
```

Administrador, setor de destino:

```json
{
  "queued": 1,
  "inProgress": 0,
  "received": 1,
  "started": 0,
  "resolved": 0,
  "transferred": 0,
  "cancelled": 0,
  "averageWaitSeconds": null,
  "averageHandlingSeconds": null
}
```

Período de 2000:

```json
{
  "queued": 1,
  "inProgress": 2,
  "received": 0,
  "started": 0,
  "resolved": 0,
  "transferred": 0,
  "cancelled": 0,
  "averageWaitSeconds": null,
  "averageHandlingSeconds": null
}
```

Filtro de atendente:

```json
{
  "queued": "não se aplica",
  "inProgress": 2,
  "received": "não se aplica",
  "started": 1,
  "resolved": 1,
  "transferred": 0,
  "cancelled": 0,
  "averageWaitSeconds": "não se aplica",
  "averageHandlingSeconds": 0
}
```

Filtro de órgão:

```json
{
  "queued": 0,
  "inProgress": 1,
  "received": 2,
  "started": 1,
  "resolved": 1,
  "transferred": 1,
  "cancelled": 0,
  "averageWaitSeconds": 1,
  "averageHandlingSeconds": 0
}
```

Filtro de módulo: Folha:

```json
{
  "queued": "não se aplica",
  "inProgress": "não se aplica",
  "received": "não se aplica",
  "started": "não se aplica",
  "resolved": 1,
  "transferred": 0,
  "cancelled": "não se aplica",
  "averageWaitSeconds": "não se aplica",
  "averageHandlingSeconds": 0
}
```

Filtro de módulo: Patrimônio:

```json
{
  "queued": "não se aplica",
  "inProgress": "não se aplica",
  "received": "não se aplica",
  "started": "não se aplica",
  "resolved": 1,
  "transferred": 1,
  "cancelled": "não se aplica",
  "averageWaitSeconds": "não se aplica",
  "averageHandlingSeconds": 0
}
```

Opções do setor:

```json
[
  {
    "name": "Atendente1 474188357",
    "active": true
  },
  {
    "name": "Atendente2 474188357",
    "active": true
  },
  {
    "name": "Supervisor 474188357",
    "active": true
  }
]
```

Recusas:

```json
[
  {
    "caso": "Atendente",
    "esperado": 403,
    "recebido": 403
  },
  {
    "caso": "Supervisor pedindo outro setor",
    "esperado": 403,
    "recebido": 403
  },
  {
    "caso": "Início depois do fim",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Data inválida",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Só uma data",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Período desconhecido",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Atendente de outro setor",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Atendente sem setor (administrador)",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Módulo sem setor (administrador)",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Módulo de outro setor (administrador)",
    "esperado": 400,
    "recebido": 400
  },
  {
    "caso": "Filtro que não é número",
    "esperado": 400,
    "recebido": 400
  }
]
```

Chamados no banco:

```json
[
  {
    "sector_id": 1,
    "status": "queued",
    "closure_type": null,
    "total": 1
  },
  {
    "sector_id": 1,
    "status": "in_progress",
    "closure_type": null,
    "total": 2
  },
  {
    "sector_id": 1,
    "status": "closed",
    "closure_type": "resolved",
    "total": 1
  },
  {
    "sector_id": 1,
    "status": "closed",
    "closure_type": "transferred",
    "total": 1
  },
  {
    "sector_id": 1,
    "status": "closed",
    "closure_type": "cancelled",
    "total": 1
  },
  {
    "sector_id": 2,
    "status": "queued",
    "closure_type": null,
    "total": 1
  }
]
```

## Jornada dashboard-return: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:52:40.822Z, duração 4 s.

#### Passos

1. ok: Preparar setor e chamado recebido (827 ms)
2. ok: API mostra a primeira atribuição e a espera calculada (263 ms)
3. ok: Devolução muda os números atuais e preserva a espera inicial (184 ms): `01-devolvido-a-fila.png`
4. ok: Nova atribuição troca a linha do atendente e mantém a espera (139 ms): `02-segundo-responsavel.png`
5. ok: Banco confirma responsável final, primeira atribuição e auditoria (287 ms)

#### Estado final observado

Primeira espera:

```json
{
  "assigned_at": "2026-11-04T20:52:44.272702+00:00",
  "wait": 2
}
```

Dashboard depois da nova atribuição:

```json
{
  "period": {
    "from": "2026-11-04",
    "to": "2026-11-04"
  },
  "sectorId": 11,
  "numbers": {
    "queued": {
      "applicable": true,
      "value": 0
    },
    "inProgress": {
      "applicable": true,
      "value": 1
    },
    "received": {
      "applicable": true,
      "value": 1
    },
    "started": {
      "applicable": true,
      "value": 0
    },
    "resolved": {
      "applicable": true,
      "value": 0
    },
    "transferred": {
      "applicable": true,
      "value": 0
    },
    "cancelled": {
      "applicable": true,
      "value": 0
    },
    "averageWaitSeconds": {
      "applicable": true,
      "value": 2
    },
    "averageHandlingSeconds": {
      "applicable": true,
      "value": null
    }
  },
  "assignees": [
    {
      "user": {
        "id": 27,
        "name": "Atendente2 560823332"
      },
      "sector": {
        "id": 11,
        "name": "Setor 560823332"
      },
      "inProgress": {
        "applicable": true,
        "value": 1
      },
      "started": {
        "applicable": true,
        "value": 0
      },
      "resolved": {
        "applicable": true,
        "value": 0
      },
      "transferred": {
        "applicable": true,
        "value": 0
      },
      "cancelled": {
        "applicable": true,
        "value": 0
      },
      "averageHandlingSeconds": {
        "applicable": true,
        "value": null
      }
    }
  ]
}
```

Estado final do chamado:

```json
{
  "status": "in_progress",
  "assignee_id": 27,
  "assigned_at": "2026-11-04T20:52:44.272702+00:00"
}
```

Auditoria:

```json
[
  {
    "action": "ticket_assigned"
  },
  {
    "action": "ticket_returned"
  },
  {
    "action": "ticket_assigned"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:41.853Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (839 ms)
2. ok: Atendente entra e vê a fila vazia (250 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (250 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (165 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (313 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (319 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (257 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (355 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (236 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1490 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (735 ms)

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
  "protocol": "2026-000011",
  "status": "in_progress",
  "assignee": "Atendente1 501853522",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 501853522"
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

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:49.674Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (629 ms)
2. ok: Sem assumir, não há como responder (462 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (193 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (390 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (281 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (135 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (220 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (296 ms)
9. ok: Pela API, quem não é responsável também é recusado (316 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (445 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (317 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (384 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (145 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 14,
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
    "body": "Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:56.255Z, duração 12 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1576 ms)
2. ok: Atendente assume o chamado (548 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (413 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1280 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (372 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (22 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1349 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (291 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (508 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1781 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (803 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (289 ms)

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
  "assignee": "Atendente1 516255800",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 516255800",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 21,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 516255800",
    "changes": {
      "assignee_id": {
        "to": 22,
        "from": 21
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 516255800",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 22
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 516255800",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 516256341",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 15,
    "subject": null
  }
]
```

Auditoria da origem:

```json
[
  {
    "action": "ticket_assigned"
  },
  {
    "action": "ticket_organization_linked"
  },
  {
    "action": "ticket_transferred_sector"
  }
]
```
