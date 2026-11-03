# Jornada reply: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:25.039Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (463 ms)
2. ok: Sem assumir, não há como responder (267 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (147 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (278 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (228 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (101 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (201 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (258 ms)
9. ok: Pela API, quem não é responsável também é recusado (273 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (384 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (301 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (274 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (147 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 25,
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
    "body": "Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
