# Jornada reply: PASSOU

Commit `2c57e5fba1c84f7fffcf617e3b9a766c1960ee54`, início 2026-11-21T14:56:49.885Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (699 ms)
2. ok: Sem assumir, não há como responder (474 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (239 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (417 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (299 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (1063 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (102 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (245 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (246 ms)
10. ok: Pela API, quem não é responsável também é recusado (300 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (551 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (474 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (388 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (143 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 2,
  "linhas": 1
}
```

Resposta indevida pela API:

```json
{
  "http": 403,
  "mensagensAlteradas": 0
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "origin": "customer",
    "type": "text",
    "status": null,
    "body": "Preciso do contracheque",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "read",
    "body": "*Atendente1 009886963:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
