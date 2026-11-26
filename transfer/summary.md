# Jornada transfer: PASSOU

Commit `c90ec44f1844d4e1d773a517ab4d908374f1f63a`, início 2026-11-26T00:22:43.860Z, duração 10 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (999 ms)
2. ok: Atendente assume o chamado (233 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (268 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (971 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (315 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (15 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (919 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (232 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (257 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1191 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (804 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (211 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (383 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (944 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (111 ms)

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
  "assignee": "Atendente1 563861591",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 563861591",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 42,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 563861591",
    "changes": {
      "assignee_id": {
        "to": 43,
        "from": 42
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 563861591",
    "changes": {
      "assignee_id": {
        "to": 42,
        "from": 43
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 563861591",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 563862898",
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
        "to": 42,
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
        "to": "2026-11-26T00:22:50.805159Z",
        "from": null
      },
      "sector_id": {
        "to": 20,
        "from": 19
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
