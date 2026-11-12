# Jornada reply: PASSOU

Commit `ee00a7cfc14d751ee50c07933c80ace785a909da`, início 2026-11-12T00:06:39.552Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (480 ms)
2. ok: Sem assumir, não há como responder (336 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (173 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (264 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (237 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (94 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (195 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (237 ms)
9. ok: Pela API, quem não é responsável também é recusado (247 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (335 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (303 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (243 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (107 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 5,
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
    "body": "Atendente1 999553904: Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Atendente1 999553904: Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Atendente1 999553904: Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
