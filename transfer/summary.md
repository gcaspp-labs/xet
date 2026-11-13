# Jornada transfer: PASSOU

Commit `f1e51347ced366695a688252de9ddc384d0c8948`, início 2026-11-13T01:15:31.247Z, duração 10 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1105 ms)
2. ok: Atendente assume o chamado (459 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (278 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (932 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (285 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (18 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (813 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (248 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (501 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1755 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (668 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (236 ms)

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
  "assignee": "Atendente1 531248041",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 531248041",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 5,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 531248041",
    "changes": {
      "assignee_id": {
        "to": 6,
        "from": 5
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 531248041",
    "changes": {
      "assignee_id": {
        "to": 5,
        "from": 6
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 531248041",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 531249973",
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
