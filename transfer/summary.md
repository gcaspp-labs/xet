# Jornada transfer: PASSOU

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:28:40.519Z, duração 7 s.

### Passos

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

### Estado final observado

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
