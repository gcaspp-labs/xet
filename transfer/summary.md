# Jornada transfer: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:17:13.333Z, duração 10 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1119 ms)
2. ok: Atendente assume o chamado (436 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (279 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1098 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (291 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (24 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (946 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (248 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (438 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1521 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (767 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
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
  "assignee": "Atendente1 033334031",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 033334031",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 20,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 033334031",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 20
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 033334031",
    "changes": {
      "assignee_id": {
        "to": 20,
        "from": 21
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 033334031",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 033335778",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 13,
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
