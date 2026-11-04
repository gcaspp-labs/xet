# Jornada transfer: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:47.789Z, duração 10 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1109 ms)
2. ok: Atendente assume o chamado (436 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (301 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1063 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (221 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (18 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (965 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (250 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (410 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1601 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (596 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (252 ms)

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
  "assignee": "Atendente1 927789184",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 927789184",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 18,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 927789184",
    "changes": {
      "assignee_id": {
        "to": 19,
        "from": 18
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 927789184",
    "changes": {
      "assignee_id": {
        "to": 18,
        "from": 19
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 927789184",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 927790770",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 10,
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
