# Jornada transfer: PASSOU

Commit `f116ad44d7e33c160235fd26d4369bb6558bc7db`, início 2026-11-25T06:00:49.576Z, duração 8 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (659 ms)
2. ok: Atendente assume o chamado (161 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (210 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (738 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (180 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (9 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (829 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (116 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (174 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1017 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (524 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (120 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (256 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (672 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (62 ms)

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
  "assignee": "Atendente1 449577267",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 449577267",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 40,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 449577267",
    "changes": {
      "assignee_id": {
        "to": 41,
        "from": 40
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 449577267",
    "changes": {
      "assignee_id": {
        "to": 40,
        "from": 41
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 449577267",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 449578413",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 29,
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
        "to": 40,
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
        "to": "2026-11-25T06:00:54.940625Z",
        "from": null
      },
      "sector_id": {
        "to": 19,
        "from": 18
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 30,
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
  "previous_ticket_id": 29
}
```
