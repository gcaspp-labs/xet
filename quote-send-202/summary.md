# Jornada quote-send-202: PASSOU

Commit `66bd14e87adefa3216ec9b5af5481b91b1522c4b`, início 2026-11-16T21:14:16.326Z, duração 39 s.

### Passos

1. ok: Preparar setor, um chamado na fila e uma figurinha do cliente (479 ms)
2. ok: Atendente abre o chamado da fila e assume pela tela (505 ms)
3. ok: A API devolve as mensagens do cliente com seus ids (19 ms)
4. ok: Responsável responde citando a pergunta; a resposta aparece na conversa (322 ms): `01-resposta-citando-na-conversa.png`
5. ok: Citar a figurinha é recusado, sem gravar nada (14 ms)
6. ok: O supervisor não cita: só o responsável responde (772 ms): `02-supervisor-acompanha.png`
7. ok: Estado final no banco (98 ms)

### Estado final observado

Resposta na API:

```json
{
  "body": "*Atendente1 656327409:*\nAté sexta-feira",
  "quote": {
    "messageId": 1,
    "type": "text",
    "text": "Qual o prazo da guia?"
  }
}
```

Recusa:

```json
{
  "error": "Não é possível responder citando esta mensagem."
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "type": "text",
    "body": "Qual o prazo da guia?",
    "status": null,
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "direction": "inbound",
    "type": "unsupported",
    "body": null,
    "status": null,
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "direction": "outbound",
    "type": "text",
    "body": "*Atendente1 656327409:*\nAté sexta-feira",
    "status": "sent",
    "quoted_external_message_id": "VERIFY-656329953",
    "quoted_message_id": 1,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da guia?"
  }
]
```
