# Jornada reply: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:16.287Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (609 ms)
2. ok: Sem assumir, não há como responder (459 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (160 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (373 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (311 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (91 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (220 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (235 ms)
9. ok: Pela API, quem não é responsável também é recusado (302 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (458 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (339 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (278 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (179 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 12,
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
