# Jornada pendente-retomada: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:39.147Z, duração 5 s.

### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (417 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (777 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (260 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (317 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (309 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (619 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (241 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (553 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (346 ms)

### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 699148930",
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 24,
  "messages": 0
}
```

Auditoria do pendente e da mesclagem:

```json
[
  {
    "ticket_id": 24,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 35,
        "from": null
      }
    }
  },
  {
    "ticket_id": 24,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 35
      }
    }
  },
  {
    "ticket_id": 25,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 35,
        "from": null
      }
    }
  },
  {
    "ticket_id": 25,
    "action": "ticket_merged",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-26T01:31:43.044037Z",
        "from": null
      },
      "message_ids": {
        "to": [
          31
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": null
      },
      "merged_into_ticket_id": {
        "to": 24,
        "from": null
      }
    }
  },
  {
    "ticket_id": 24,
    "action": "ticket_resumed_by_merge",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "pending"
      },
      "assignee_id": {
        "to": 35,
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000025",
        "from": null
      },
      "merged_ticket_id": {
        "to": 25,
        "from": null
      }
    }
  }
]
```
