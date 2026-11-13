# Jornada reply: PASSOU

Commit `800b799f91601ce41d93c97fe6ab1e851bd43449`, início 2026-11-13T12:03:01.689Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (514 ms)
2. ok: Sem assumir, não há como responder (258 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (173 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (284 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (307 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (90 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (203 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (272 ms)
9. ok: Pela API, quem não é responsável também é recusado (230 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (323 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (310 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (331 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (95 ms)

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
    "body": "*Atendente1 381690848:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 381690848:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 381690848:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
