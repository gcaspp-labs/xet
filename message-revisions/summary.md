# Jornada message-revisions: PASSOU

Commit `c2b6621e1f32034dd511bb01fcbe91129d3d02f6`, início 2026-11-26T22:30:40.166Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado com um atendente (518 ms)
2. ok: Mensagem do cliente chega à fila (40 ms)
3. ok: Atendente assume e vê a mensagem original (390 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (225 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (450 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (396 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (391 ms)

### Estado final observado

Mensagem:

```json
{
  "id": 1,
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
