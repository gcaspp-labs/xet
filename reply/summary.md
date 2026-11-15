# Jornada reply: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:57.702Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (422 ms)
2. ok: Sem assumir, não há como responder (384 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (190 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (226 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (263 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (83 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (196 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (282 ms)
9. ok: Pela API, quem não é responsável também é recusado (244 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (358 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (277 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (267 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (118 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 21,
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
    "body": "*Atendente1 637703687:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 637703687:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 637703687:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
