# Jornada transfer: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:52.638Z, duração 6 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (715 ms)
2. ok: Atendente assume o chamado (226 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (183 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (681 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (232 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (7 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (562 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (135 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (277 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1105 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (383 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (120 ms)

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
  "assignee": "Atendente1 912639678",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 912639678",
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
    "actor": "Atendente1 912639678",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 912639678",
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
    "sector": "Setor 912639678",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 912640957",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 6,
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
