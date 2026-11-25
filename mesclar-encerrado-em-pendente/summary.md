# Jornada mesclar-encerrado-em-pendente: PASSOU

Commit `90cf6bd255a339cde214654e9bcdebb02b7a1a2e`, início 2026-11-25T06:29:54.351Z, duração 4 s.

### Passos

1. ok: Preparar setor com módulo e órgão, com o contato cadastrado e a primeira mensagem (371 ms)
2. ok: Atendente assume o chamado A e o coloca como pendente, com motivo (615 ms): `01-a-pendente.png`
3. ok: Cliente volta a escrever e o chamado B entra na Fila (176 ms): `02-b-na-fila.png`
4. ok: Atendente assume B e encerra o atendimento com assunto e resolução (746 ms): `03-b-formulario-de-encerramento.png`
5. ok: Em Atendimentos, abre o encerrado e usa Mesclar em pendente com A escolhido (536 ms): `04-janela-mesclar-em-pendente.png`
6. ok: A abre como Encerrado, com os dados de B, as mensagens dos dois na ordem e o aviso (165 ms): `05-a-encerrado-com-as-mensagens-dos-dois.png`
7. ok: B aparece em Atendimentos como Mesclado, com o link para A (292 ms): `06-b-mesclado-com-link-para-a.png`
8. ok: A não está mais na aba Pendentes (199 ms): `07-pendentes-vazio.png`
9. ok: Estado final no banco: A encerrado com os dados de B, B mesclado em A (174 ms)

### Estado final observado

Chamado A encerrado com os dados de B:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Comprovante de férias",
  "resolution": "Comprovante enviado por e-mail, a pedido da servidora.",
  "organization": "Prefeitura 194353571",
  "closed_by": "Atendente1 194352743",
  "merged_into_ticket_id": null,
  "messages": 2
}
```

Chamado B mesclado:

```json
{
  "status": "closed",
  "closure_type": "merged",
  "merged_into_ticket_id": 1,
  "messages": 0
}
```

Auditoria do pendente, do encerramento e da mesclagem:

```json
[
  {
    "ticket_id": 1,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 3,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 1,
    "action": "ticket_pending",
    "changes": {
      "status": {
        "to": "pending",
        "from": "in_progress"
      },
      "assignee_id": {
        "to": null,
        "from": 3
      }
    },
    "reason": "Aguardando o órgão confirmar o número antigo do protocolo"
  },
  {
    "ticket_id": 2,
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 3,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 2,
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
        "to": "2026-11-25T06:29:56.750435Z",
        "from": null
      },
      "module_ids": {
        "to": [
          1
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
    "ticket_id": 2,
    "action": "ticket_merged",
    "changes": {
      "subject": {
        "to": null,
        "from": "Comprovante de férias"
      },
      "module_ids": {
        "to": [],
        "from": [
          1
        ]
      },
      "resolution": {
        "to": null,
        "from": "Comprovante enviado por e-mail, a pedido da servidora."
      },
      "message_ids": {
        "to": [
          2
        ],
        "from": null
      },
      "closure_type": {
        "to": "merged",
        "from": "resolved"
      },
      "merged_into_ticket_id": {
        "to": 1,
        "from": null
      }
    },
    "reason": null
  },
  {
    "ticket_id": 1,
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
        "to": "2026-11-25T06:29:56.750435Z",
        "from": null
      },
      "closed_at": {
        "to": "2026-11-25T06:29:56.750435Z",
        "from": null
      },
      "module_ids": {
        "to": [
          1
        ],
        "from": null
      },
      "resolution": {
        "to": "Comprovante enviado por e-mail, a pedido da servidora.",
        "from": null
      },
      "assignee_id": {
        "to": 3,
        "from": null
      },
      "closed_by_id": {
        "to": 3,
        "from": null
      },
      "closure_type": {
        "to": "resolved",
        "from": null
      },
      "merged_protocol": {
        "to": "2026-000002",
        "from": null
      },
      "merged_ticket_id": {
        "to": 2,
        "from": null
      }
    },
    "reason": null
  }
]
```
