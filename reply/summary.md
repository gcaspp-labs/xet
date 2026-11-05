# Jornada reply: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:11.937Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (443 ms)
2. ok: Sem assumir, não há como responder (308 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (148 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (320 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (253 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (79 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (201 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (254 ms)
9. ok: Pela API, quem não é responsável também é recusado (283 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (465 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (318 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (284 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (109 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 13,
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
    "body": "Atendente1 011938776: Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Atendente1 011938776: Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Atendente1 011938776: Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
