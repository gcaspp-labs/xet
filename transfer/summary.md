# Jornada transfer: PASSOU

Commit `b6f41b290963c4b86ce4afb9f97c24f377876af1`, início 2026-11-05T02:45:30.981Z, duração 12 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1576 ms)
2. ok: Atendente assume o chamado (361 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (415 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1022 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (363 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (22 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (880 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (297 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (627 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (2082 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (728 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (278 ms)

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
  "assignee": "Atendente1 730982662",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 730982662",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 16,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 730982662",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 730982662",
    "changes": {
      "assignee_id": {
        "to": 16,
        "from": 17
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 730982662",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 730983585",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 8,
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
