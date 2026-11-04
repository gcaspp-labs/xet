# Jornada dashboard-api: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:14.188Z, duração 6 s.

### Passos

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

### Estado final observado

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
