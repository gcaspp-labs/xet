# Jornada transfer: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:17.109Z, duração 10 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1124 ms)
2. ok: Atendente assume o chamado (357 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (292 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (911 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (318 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (16 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (956 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (247 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (400 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1683 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (694 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (249 ms)

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
  "assignee": "Atendente1 017109023",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 017109023",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 13,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 017109023",
    "changes": {
      "assignee_id": {
        "to": 14,
        "from": 13
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 017109023",
    "changes": {
      "assignee_id": {
        "to": 13,
        "from": 14
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 017109023",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 017110675",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 7,
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
