# Jornada reply: PASSOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:51:49.207Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (270 ms)
2. ok: Sem assumir, não há como responder (168 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (92 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (214 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (169 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (53 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (143 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (134 ms)
9. ok: Pela API, quem não é responsável também é recusado (143 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (289 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (199 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (171 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (62 ms)

### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 6,
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
