# Jornada reply: PASSOU

Commit `a9441d8c979712c623b185704ddc9b7f4549873c`, início 2026-11-22T17:17:39.081Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (597 ms)
2. ok: Sem assumir, não há como responder (546 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (247 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (379 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (301 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (917 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (82 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (239 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (267 ms)
10. ok: Pela API, quem não é responsável também é recusado (288 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (544 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (454 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (333 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (139 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 35,
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
    "body": "*Atendente1 859081786:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 859081786:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 859081786:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 859081786:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
