# Jornada pendente-retomada: PASSOU

Commit `90cf6bd255a339cde214654e9bcdebb02b7a1a2e`, início 2026-11-25T06:30:00.763Z, duração 4 s.

### Passos

1. ok: Preparar setor com atendente e supervisor, e a primeira mensagem do cliente (293 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (600 ms)
3. ok: A aparece na aba Pendentes com protocolo, motivo, quem marcou e o Retomar (142 ms): `01-aba-pendentes.png`
4. ok: Supervisor vê o chamado no quadro Pendentes do Dashboard (241 ms): `02-dashboard-pendentes.png`
5. ok: Cliente volta a escrever e o chamado B entra na Fila (190 ms): `03-b-na-fila.png`
6. ok: Atendente assume B, vê o aviso de pendente e retoma A pela janela (480 ms): `04-aviso-do-pendente.png`, `05-janela-retomar.png`
7. ok: A abre com as mensagens dos dois na ordem do tempo e os avisos (125 ms): `06-a-com-as-mensagens-dos-dois.png`
8. ok: B aparece em Atendimentos como Mesclado, com o link para A (316 ms): `07-b-mesclado-na-lista.png`, `08-link-para-o-original.png`
9. ok: Estado final no banco: A em atendimento com as mensagens dos dois, B mesclado nele (183 ms)

### Estado final observado

Chamado A retomado:

```json
{
  "status": "in_progress",
  "closure_type": null,
  "assignee": "Atendente1 200764803",
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 5,
  "messages": 0
}
```

Auditoria do pendente e da mesclagem:

```json
[
  {
    "ticket_id": 5,
    "action": "ticket_assigned",
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
    "ticket_id": 5,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 7
      }
    }
  },
  {
    "ticket_id": 6,
    "action": "ticket_assigned",
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
    "ticket_id": 6,
    "action": "ticket_merged",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-25T06:30:03.634625Z",
        "from": null
      },
      "message_ids": {
        "to": [
          6
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": null
      },
      "merged_into_ticket_id": {
        "to": 5,
        "from": null
      }
    }
  },
  {
    "ticket_id": 5,
    "action": "ticket_resumed_by_merge",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "pending"
      },
      "assignee_id": {
        "to": 7,
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000006",
        "from": null
      },
      "merged_ticket_id": {
        "to": 6,
        "from": null
      }
    }
  }
]
```
