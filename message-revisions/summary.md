# Jornada message-revisions: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:03:04.513Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado com um atendente (249 ms)
2. ok: Mensagem do cliente chega à fila (11 ms)
3. ok: Atendente assume e vê a mensagem original (227 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (126 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (198 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (229 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (174 ms)

### Estado final observado

Mensagem:

```json
{
  "id": 21,
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
