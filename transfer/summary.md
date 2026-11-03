# Jornada transfer: PASSOU

Commit `6a2d0b04128a403717916da7b6ce948e6841dce1`, início 2026-11-03T20:36:53.869Z, duração 9 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1115 ms)
2. ok: Atendente assume o chamado (242 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (288 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1084 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (238 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (15 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (957 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (227 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (432 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1482 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (569 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (246 ms)

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
  "assignee": "Atendente1 213869621",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 213869621",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 22,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 213869621",
    "changes": {
      "assignee_id": {
        "to": 23,
        "from": 22
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 213869621",
    "changes": {
      "assignee_id": {
        "to": 22,
        "from": 23
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 213869621",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 213870027",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 28,
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
