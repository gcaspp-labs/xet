# Jornada message-revisions: PASSOU

Commit `70c54fbd7fe9a0501eb0bbf7066f237e5f431160`, início 2026-11-19T22:34:14.334Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com um atendente (427 ms)
2. ok: Mensagem do cliente chega à fila (38 ms)
3. ok: Atendente assume e vê a mensagem original (389 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (174 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (301 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (270 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (353 ms)

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
