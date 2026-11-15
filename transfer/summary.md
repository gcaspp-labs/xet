# Jornada transfer: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:44:02.627Z, duração 11 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1001 ms)
2. ok: Atendente assume o chamado (206 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (277 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (917 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (245 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (19 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (965 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (241 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (293 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (2033 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (773 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (240 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (327 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (854 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (111 ms)

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
  "assignee": "Atendente1 642628079",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 642628079",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 27,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 642628079",
    "changes": {
      "assignee_id": {
        "to": 28,
        "from": 27
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 642628079",
    "changes": {
      "assignee_id": {
        "to": 27,
        "from": 28
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 642628079",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 642629976",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 20,
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
  "previous_ticket_id": 20
}
```
