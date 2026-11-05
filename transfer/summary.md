# Jornada transfer: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:24:09.367Z, duração 12 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1394 ms)
2. ok: Atendente assume o chamado (337 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (333 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1056 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (359 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (17 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1071 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (267 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (549 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (2063 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (861 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (258 ms)

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
  "assignee": "Atendente1 249368097",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 249368097",
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
    "actor": "Atendente1 249368097",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 249368097",
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
    "sector": "Setor 249368097",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 249369217",
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
