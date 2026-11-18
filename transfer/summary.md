# Jornada transfer: PASSOU

Commit `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1`, início 2026-11-18T01:51:33.686Z, duração 8 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (598 ms)
2. ok: Atendente assume o chamado (176 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (208 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (671 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (200 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (10 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (799 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (116 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (169 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1464 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (459 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (120 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (250 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (667 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (56 ms)

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
  "assignee": "Atendente1 693687302",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 693687302",
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
    "actor": "Atendente1 693687302",
    "changes": {
      "assignee_id": {
        "to": 8,
        "from": 7
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 693687302",
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
    "sector": "Setor 693687302",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 693688072",
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

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 6
}
```
