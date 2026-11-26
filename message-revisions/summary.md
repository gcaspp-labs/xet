# Jornada message-revisions: PASSOU

Commit `79743f434020df3f335acecca04d65c9cc7d67c7`, início 2026-11-26T02:04:06.355Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com um atendente (390 ms)
2. ok: Mensagem do cliente chega à fila (9 ms)
3. ok: Atendente assume e vê a mensagem original (320 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (164 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (265 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (229 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (335 ms)

### Estado final observado

Mensagem:

```json
{
  "id": 57,
  "body": "Preciso do balancete de outubro",
  "edited": true,
  "deletion_scope": "everyone",
  "deletion_origin": "customer"
}
```

Versões e exclusão (message_changes):

```json
[
  {
    "kind": "edit",
    "origin": "customer",
    "body": "versão antiga atrasada"
  },
  {
    "kind": "original",
    "origin": "customer",
    "body": "Preciso do balancete de setembro"
  },
  {
    "kind": "edit",
    "origin": "customer",
    "body": "Preciso do balancete de outubro"
  },
  {
    "kind": "deletion",
    "origin": "customer",
    "body": null
  }
]
```

Chamados do setor:

```json
[
  {
    "status": "in_progress"
  }
]
```
