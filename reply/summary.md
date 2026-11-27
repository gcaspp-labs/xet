# Jornada reply: PASSOU

Commit `87098f246797e5ca98b43e6beae2a569f8c2e7f8`, início 2026-11-27T16:57:52.522Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (631 ms)
2. ok: Sem assumir, não há como responder (594 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (264 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (411 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (368 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (934 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (105 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (287 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (277 ms)
10. ok: Pela API, quem não é responsável também é recusado (292 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (547 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (525 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (354 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (152 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 10,
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
    "body": "*Atendente1 672523058:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 672523058:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 672523058:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 672523058:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
