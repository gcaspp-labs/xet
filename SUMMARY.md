# Verificação run-20261104-174702

- Commit: `143e165648781335e66799e8cabbe825b85ddb61` (branch `task/47-api-do-dashboard-do-atendimento`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 17:47:05 -0300
- Resumo gerado em: 2026-11-04 17:47:47 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| dashboard-api (fora do mapa) | PASSOU | 11 | `evidence/dashboard-api/` |

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
- Log: `/home/thiagocalazans/code/xet-implementador/.verify-app/runs/run-20261104-174702/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 4 arquivo(s) em /home/thiagocalazans/code/xet-implementador/.verify-app/runs/run-20261104-174702/evidence.

## Detalhe de cada jornada

## Jornada dashboard-api: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:47:16.887Z, duração 7 s.

#### Passos

1. ok: Preparar dois setores, módulos e um órgão (1724 ms)
2. ok: Gerar chamados pelas rotas do produto: fila, atendimento, iniciado, encerrado, cancelado e transferido (1157 ms)
3. ok: Supervisor vê os números do próprio setor, sem pedir o setor (219 ms): `01-resposta-do-supervisor.png`
4. ok: Tabela por atendente: responsável final e sem linhas zeradas (29 ms)
5. ok: Administrador vê todos os setores, e a transferência conta na origem e no destino (97 ms)
6. ok: Período: "agora" não muda; o que depende de data muda, e média sem dados vem vazia (77 ms)
7. ok: Filtros seguem a tabela da spec, com "não se aplica" (119 ms)
8. ok: Correção de módulos muda os números (81 ms)
9. ok: Opções do filtro de atendente (49 ms)
10. ok: Permissões e filtros inválidos são recusados (137 ms)
11. ok: Estado final no banco bate com os números da API (259 ms)

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
    "nome": "Atendente1 236888576",
    "setor": "Setor 236888576",
    "inProgress": 2,
    "started": 1,
    "resolved": 1,
    "transferred": 0,
    "cancelled": 0
  },
  {
    "nome": "Atendente2 236888576",
    "setor": "Setor 236888576",
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
    "name": "Atendente1 236888576",
    "active": true
  },
  {
    "name": "Atendente2 236888576",
    "active": true
  },
  {
    "name": "Supervisor 236888576",
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
