# Jornada dashboard-return: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:52:40.822Z, duração 4 s.

### Passos

1. ok: Preparar setor e chamado recebido (827 ms)
2. ok: API mostra a primeira atribuição e a espera calculada (263 ms)
3. ok: Devolução muda os números atuais e preserva a espera inicial (184 ms): `01-devolvido-a-fila.png`
4. ok: Nova atribuição troca a linha do atendente e mantém a espera (139 ms): `02-segundo-responsavel.png`
5. ok: Banco confirma responsável final, primeira atribuição e auditoria (287 ms)

### Estado final observado

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
