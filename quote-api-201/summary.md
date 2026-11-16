# Jornada quote-api-201: PASSOU

Commit `fb3bf066640d1660de40644d21b948a16b89b447`, início 2026-11-16T18:09:00.690Z, duração 2 s.

### Passos

1. ok: Preparar setor e mensagens do cliente com citação (celular simulado) (407 ms)
2. ok: Atendente abre o chamado da fila pela tela (413 ms): `01-conversa-com-respostas-citadas.png`
3. ok: A API da conversa devolve a citação nos três casos do provedor (15 ms)
4. ok: Depois de recarregar a página, a citação continua (233 ms): `02-conversa-depois-de-recarregar.png`
5. ok: Estado final no banco (175 ms)

### Estado final observado

Citações na API (sessão do atendente):

```json
{
  "Qual o prazo da guia?": null,
  "Isso, essa mesma": {
    "messageId": 1,
    "type": "text",
    "text": "Qual o prazo da guia?"
  },
  "E sobre o arquivo?": {
    "messageId": null,
    "type": "document",
    "text": "contrato.pdf"
  },
  "Lembra disso?": {
    "messageId": null,
    "type": null,
    "text": null
  },
  "Obrigada": null
}
```

Mensagens do chamado com a citação gravada:

```json
[
  {
    "external_message_id": "VERIFY-540693188",
    "body": "Qual o prazo da guia?",
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "external_message_id": "VERIFY-540693188-Q1",
    "body": "Isso, essa mesma",
    "quoted_external_message_id": "VERIFY-540693188",
    "quoted_message_id": 1,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da guia?"
  },
  {
    "external_message_id": "VERIFY-540693188-Q2",
    "body": "E sobre o arquivo?",
    "quoted_external_message_id": "ANTES-DO-XET-1",
    "quoted_message_id": null,
    "quoted_type": "document",
    "quoted_body": "contrato.pdf"
  },
  {
    "external_message_id": "VERIFY-540693188-Q3",
    "body": "Lembra disso?",
    "quoted_external_message_id": "SEM-TRECHO-1",
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "external_message_id": "VERIFY-540693188-Q4",
    "body": "Obrigada",
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  }
]
```
