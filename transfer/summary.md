# Jornada transfer: PASSOU

Commit `7ba82c3bd1b60cb925b343ea2c209ed7bcce3a49`, início 2026-11-18T08:59:03.751Z, duração 7 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (658 ms)
2. ok: Atendente assume o chamado (156 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (179 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (704 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (154 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (8 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (783 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (113 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (279 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (834 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (500 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (125 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (259 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (650 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (54 ms)

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
  "assignee": "Atendente1 343752037",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 343752037",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 32,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 343752037",
    "changes": {
      "assignee_id": {
        "to": 33,
        "from": 32
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 343752037",
    "changes": {
      "assignee_id": {
        "to": 32,
        "from": 33
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 343752037",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 343753718",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 23,
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
        "to": 32,
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
        "to": "2026-11-18T08:59:08.787486Z",
        "from": null
      },
      "sector_id": {
        "to": 15,
        "from": 14
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 24,
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
  "previous_ticket_id": 23
}
```
