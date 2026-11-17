# Jornada transfer: PASSOU

Commit `e33fd59141d478512f00c8dade6e14926605a9d7`, início 2026-11-17T23:22:19.324Z, duração 8 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (598 ms)
2. ok: Atendente assume o chamado (147 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (195 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (815 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (219 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (8 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (776 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (117 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (193 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1522 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (420 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (102 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (298 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (666 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
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
  "assignee": "Atendente1 739324118",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 739324118",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 7,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 739324118",
    "changes": {
      "assignee_id": {
        "to": 8,
        "from": 7
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 739324118",
    "changes": {
      "assignee_id": {
        "to": 7,
        "from": 8
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 739324118",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 739325294",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 4,
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

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 4
}
```
