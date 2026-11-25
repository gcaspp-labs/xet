# Jornada transfer: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:03:13.438Z, duração 8 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (654 ms)
2. ok: Atendente assume o chamado (178 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (187 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (746 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (175 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (8 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (776 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (119 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (212 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (902 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (499 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (112 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (292 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (712 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (53 ms)

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
  "assignee": "Atendente1 193439182",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 193439182",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 48,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 193439182",
    "changes": {
      "assignee_id": {
        "to": 49,
        "from": 48
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 193439182",
    "changes": {
      "assignee_id": {
        "to": 48,
        "from": 49
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 193439182",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 193440591",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 37,
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
        "to": 48,
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
        "to": "2026-11-25T07:03:18.626292Z",
        "from": null
      },
      "sector_id": {
        "to": 23,
        "from": 22
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 38,
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
  "previous_ticket_id": 37
}
```
