# Jornada transfer: PASSOU

Commit `0b150b2166726e70a52531cf39142470479cb64a`, início 2026-11-18T07:38:17.025Z, duração 7 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (609 ms)
2. ok: Atendente assume o chamado (185 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (225 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (781 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (217 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (6 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (845 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (120 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (183 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (998 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (468 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (109 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (257 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (610 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
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
  "assignee": "Atendente1 497026107",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 497026107",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 3,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 497026107",
    "changes": {
      "assignee_id": {
        "to": 4,
        "from": 3
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 497026107",
    "changes": {
      "assignee_id": {
        "to": 3,
        "from": 4
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 497026107",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor."
  },
  {
    "sector": "Setor 497027992",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 2,
    "subject": null,
    "transfer_reason": null
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
    "action": "ticket_transferred_sector"
  }
]
```

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 2
}
```
