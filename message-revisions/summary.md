# Jornada message-revisions: PASSOU

Commit `dc621286b268789cf661862103336e322d3f3e37`, início 2026-11-19T23:07:40.245Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com um atendente (438 ms)
2. ok: Mensagem do cliente chega à fila (28 ms)
3. ok: Atendente assume e vê a mensagem original (369 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (229 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (321 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (280 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (344 ms)

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
