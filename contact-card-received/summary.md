# Jornada contact-card-received: PASSOU

Commit `d3fb805848ecd31c32bd2e10cebed3ccc990c425`, início 2026-11-21T08:10:11.669Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado com um atendente (466 ms)
2. ok: Contato antigo, gravado como não suportado, chega primeiro (118 ms)
3. ok: Cliente envia três contatos de uma vez; a fila mostra como hoje (110 ms): `01-fila-com-contato.png`
4. ok: Reentrega do mesmo contato não duplica (124 ms)
5. ok: Atendente assume e vê a mensagem como não suportada (344 ms): `02-conversa-com-contato.png`
6. ok: Estado final: API e banco com os cartões, antigo sem mudança (231 ms)

### Estado final observado

API: cartões da mensagem contact:

```json
[
  {
    "name": "João Silva",
    "organization": "Prefeitura de Itu",
    "phones": [
      {
        "phone": "5511977776666",
        "whatsAppId": "5511977776666"
      },
      {
        "phone": "1140221000",
        "whatsAppId": null
      }
    ]
  },
  {
    "name": "Maria da Contabilidade",
    "organization": null,
    "phones": [
      {
        "phone": "5521966665555",
        "whatsAppId": null
      }
    ]
  },
  {
    "name": "Pedro Souza",
    "organization": null,
    "phones": []
  }
]
```

API: lastMessage do chamado:

```json
{
  "type": "contact",
  "body": null,
  "origin": "customer",
  "sentAt": "2026-11-21T05:10:13.132903-03:00",
  "hidden": false,
  "contactName": "João Silva"
}
```

Banco: mensagens do chamado:

```json
[
  {
    "external_message_id": "VERIFY-323-OLD",
    "type": "unsupported",
    "body": null,
    "contact_cards": null
  },
  {
    "external_message_id": "VERIFY-323-CT",
    "type": "contact",
    "body": null,
    "contact_cards": [
      {
        "name": "João Silva",
        "phones": [
          {
            "phone": "5511977776666",
            "wa_id": "5511977776666"
          },
          {
            "phone": "1140221000",
            "wa_id": null
          }
        ],
        "organization": "Prefeitura de Itu"
      },
      {
        "name": "Maria da Contabilidade",
        "phones": [
          {
            "phone": "5521966665555",
            "wa_id": null
          }
        ],
        "organization": null
      },
      {
        "name": "Pedro Souza",
        "phones": [],
        "organization": null
      }
    ]
  }
]
```
