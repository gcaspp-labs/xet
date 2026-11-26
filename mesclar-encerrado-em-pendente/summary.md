# Jornada mesclar-encerrado-em-pendente: PASSOU

Commit `1f319abd65aee3c5bcca663fdb833cbb047b9c90`, início 2026-11-26T02:52:39.312Z, duração 6 s.

### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (543 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (798 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (308 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (1001 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (712 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (312 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (451 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (238 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (349 ms)

### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 559314876",
  "closed_by": "Atendente1 559313141",
  "merged_into_ticket_id": null,
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 13,
  "messages": 0
}
```

Auditoria do pendente, do encerramento e da mesclagem:

```json
[
  {
    "ticket_id": 13,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 17,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 13,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 17
      }
    },
    "reason": "Aguardando o órgão confirmar o número antigo do protocolo"
  },
  {
    "ticket_id": 14,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 17,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 14,
    "action": "ticket_closed",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "subject": {
        "to": "Comprovante de férias",
        "from": null
      },
      "ended_at": {
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "module_ids": {
        "to": [
          3
        ],
        "from": []
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 14,
    "action": "ticket_merged",
    "changes": {
      "subject": {
        "to": null,
        "from": "Comprovante de férias"
      },
      "module_ids": {
        "to": [],
        "from": [
          3
        ]
      },
      "resolution": {
        "to": null,
        "from": "Comprovante enviado por e-mail, a pedido da servidora."
      },
      "message_ids": {
        "to": [
          16
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": "resolved"
      },
      "merged_into_ticket_id": {
        "to": 13,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 13,
    "action": "ticket_closed_by_merge",
    "changes": {
      "status": {
        "to": "closed",
        "from": "pending"
      },
      "subject": {
        "to": "Comprovante de férias",
        "from": null
      },
      "ended_at": {
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-26T02:52:42.608993Z",
        "from": null
      },
      "module_ids": {
        "to": [
          3
        ],
        "from": null
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      },
      "assignee_id": {
        "to": 17,
        "from": null
      },
      "closed_by_id": {
        "to": 17,
        "from": null
      },
      "closure_type": {
        "to": "resolved",
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000014",
        "from": null
      },
      "merged_ticket_id": {
        "to": 14,
        "from": null
      }
    },
    "reason": null
  }
]
```
