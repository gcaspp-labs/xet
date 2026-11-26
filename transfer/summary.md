# Jornada transfer: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:22.582Z, duração 11 s.

### Passos

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
