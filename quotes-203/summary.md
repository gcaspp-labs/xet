# Jornada quotes-203: PASSOU

Commit `d1711bab9c118dd9672c4f1d6bd2ce8528e870ce`, início 2026-11-16T22:50:08.821Z, duração 4 s.

### Passos

1. ok: Preparar setor, atendente e um cliente que cita mensagens (502 ms)
2. ok: Abrir o chamado da fila e assumir (471 ms)
3. ok: Citações recebidas: conhecida, trecho do WhatsApp e indisponível (112 ms): `01-citacoes-recebidas.png`
4. ok: Botão de responder ao lado do balão e citação em preparo (321 ms): `02-botao-responder.png`, `03-em-preparo.png`
5. ok: Cancelar a citação e voltar a citar; enviar mostra a citação no balão (446 ms): `04-enviada-com-citacao.png`
6. ok: Recarregar mantém a citação; chamado de outra pessoa não tem o botão (1057 ms): `05-sem-permissao.png`
7. ok: Estado final no banco (107 ms)

### Estado final observado

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "body": "Qual o prazo da nota?",
    "linked": false,
    "quoted_type": null,
    "quoted_body": null,
    "has_quote": false
  },
  {
    "direction": "inbound",
    "body": "Isso mesmo",
    "linked": true,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da nota?",
    "has_quote": true
  },
  {
    "direction": "inbound",
    "body": "E este?",
    "linked": false,
    "quoted_type": "document",
    "quoted_body": "contrato.pdf",
    "has_quote": true
  },
  {
    "direction": "inbound",
    "body": "Oi?",
    "linked": false,
    "quoted_type": null,
    "quoted_body": null,
    "has_quote": true
  },
  {
    "direction": "outbound",
    "body": "*Atendente1 408822172:*\nO prazo é sexta-feira",
    "linked": true,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da nota?",
    "has_quote": true
  }
]
```
