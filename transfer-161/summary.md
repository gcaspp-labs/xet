# Jornada transfer-161: PASSOU

Commit `73d1edf61a12b80c5c2e36a620379e77b4b5ff02`, início 2026-11-13T16:20:40.283Z, duração 9 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1075 ms)
2. ok: Atendente assume o chamado (418 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (253 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (713 ms): `02-escolher-destino.png`, `03-retorno-conversas.png`, `04-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (247 ms): `05-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (11 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (789 ms): `06-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (240 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (414 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1806 ms): `07-formulario-outro-setor.png`, `08-retorno-apos-outro-setor.png`, `09-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (668 ms): `10-destino-na-fila.png`, `11-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (231 ms)

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
  "assignee": "Atendente1 840284823",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 840284823",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 8,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 840284823",
    "changes": {
      "assignee_id": {
        "to": 9,
        "from": 8
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 840284823",
    "changes": {
      "assignee_id": {
        "to": 8,
        "from": 9
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 840284823",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 840285612",
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
