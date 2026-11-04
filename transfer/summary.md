# Jornada transfer: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:56.255Z, duração 12 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1576 ms)
2. ok: Atendente assume o chamado (548 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (413 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1280 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (372 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (22 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1349 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (291 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (508 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1781 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (803 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (289 ms)

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
  "assignee": "Atendente1 516255800",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 516255800",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 21,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 516255800",
    "changes": {
      "assignee_id": {
        "to": 22,
        "from": 21
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 516255800",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 22
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 516255800",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 516256341",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 15,
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
