# Jornada message-revisions: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:59.527Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado com um atendente (256 ms)
2. ok: Mensagem do cliente chega à fila (17 ms)
3. ok: Atendente assume e vê a mensagem original (237 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (117 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (182 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (199 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (169 ms)

### Estado final observado

Mensagem:

```json
{
  "id": 35,
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
