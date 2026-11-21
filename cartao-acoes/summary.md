# Jornada cartao-acoes: PASSOU

Commit `3b67c920990393ba7d1465607813972b518109bc`, início 2026-11-21T16:39:32.164Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, órgão e contato do cadastro (580 ms)
2. ok: O cliente manda um cartão de contato e a fila mostra "👤 João Silva" (26 ms)
3. ok: A fila mostra a prévia com o nome do contato do cartão (100 ms): `01-fila-com-cartao.png`
4. ok: O atendente abre o chamado, assume e o cartão aparece na conversa (497 ms): `02-cartao-na-conversa.png`
5. ok: O responsável reage ao cartão pela barra de reações (488 ms): `03-reacao-do-setor-no-cartao.png`
6. ok: A reação do cliente ao cartão aparece embaixo dele (180 ms): `04-reacao-do-cliente-no-cartao.png`
7. ok: Responder no cartão mostra "👤 João Silva" na citação em preparo (517 ms): `05-citacao-em-preparo-do-cartao.png`, `06-resposta-citando-o-cartao.png`
8. ok: Com a citação em preparo, a janela "Enviar contato" manda o cartão citando a mensagem (809 ms): `07-cartao-enviado-citando.png`
9. ok: Estado final no banco e na API (323 ms)

### Estado final observado

Cartão recebido:

```json
[
  {
    "type": "contact",
    "contact_cards": [
      {
        "name": "João Silva",
        "phones": [
          {
            "phone": "5511988881234",
            "wa_id": "5511988881234"
          }
        ],
        "organization": "Prefeitura de Itu"
      }
    ]
  }
]
```

Citações gravadas:

```json
[
  {
    "id": 1,
    "type": "contact",
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "id": 2,
    "type": "text",
    "quoted_message_id": 1,
    "quoted_type": "contact",
    "quoted_body": "João Silva"
  },
  {
    "id": 3,
    "type": "contact",
    "quoted_message_id": 1,
    "quoted_type": "contact",
    "quoted_body": "João Silva"
  }
]
```
