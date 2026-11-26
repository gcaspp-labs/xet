# Jornada message-revisions: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:36.298Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com um atendente (391 ms)
2. ok: Mensagem do cliente chega à fila (14 ms)
3. ok: Atendente assume e vê a mensagem original (301 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (133 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (259 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (238 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (357 ms)

### Estado final observado

Mensagem:

```json
{
  "id": 29,
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
