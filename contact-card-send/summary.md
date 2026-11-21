# Jornada contact-card-send: PASSOU

Commit `15ec9df07c9fc2e6bfb12f189300e5de61adc0b1`, início 2026-11-21T08:55:31.747Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado, contato cadastrado e cliente (454 ms)
2. ok: Atendente assume o chamado (311 ms): `01-chamado-assumido.png`
3. ok: Responsável envia o contato cadastrado como cartão (155 ms): `02-cartao-enviado-na-conversa.png`
4. ok: Repetir a requisição não cria outra mensagem (122 ms)
5. ok: Contato não cadastrado é recusado sem gravar (142 ms)
6. ok: Cartão como resposta citada da mensagem do cliente (238 ms): `03-cartao-citando.png`
7. ok: Estado final: cartões gravados, sem apelido, com o órgão e o município (150 ms)

### Estado final observado

Resposta do envio:

```json
{
  "id": 2,
  "ticketId": 1,
  "status": "sent",
  "failureReason": null
}
```

Recusa do contato não cadastrado:

```json
{
  "error": "Só é possível enviar contatos cadastrados com telefone."
}
```

API: cartão enviado:

```json
[
  {
    "name": "Carla Cadastro",
    "organization": "Prefeitura 331749147 — Itu",
    "phones": [
      {
        "phone": "5511331750675",
        "whatsAppId": null
      }
    ]
  }
]
```

Banco: mensagens enviadas:

```json
[
  {
    "id": 2,
    "type": "contact",
    "body": null,
    "status": "sent",
    "author_id": 3,
    "contact_cards": [
      {
        "name": "Carla Cadastro",
        "phones": [
          {
            "phone": "5511331750675",
            "wa_id": null
          }
        ],
        "organization": "Prefeitura 331749147 — Itu"
      }
    ],
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "id": 3,
    "type": "contact",
    "body": null,
    "status": "sent",
    "author_id": 3,
    "contact_cards": [
      {
        "name": "Carla Cadastro",
        "phones": [
          {
            "phone": "5511331750675",
            "wa_id": null
          }
        ],
        "organization": "Prefeitura 331749147 — Itu"
      }
    ],
    "quoted_type": "text",
    "quoted_body": "Bom dia, preciso do contato da prefeitura"
  }
]
```
