# Jornada edit-delete-sent-message: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:47.866Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (336 ms)
2. ok: Mensagem do cliente chega à fila (15 ms)
3. ok: Atendente assume e responde (328 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (10 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (170 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (101 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (13 ms)
8. ok: Segunda mensagem é excluída só no XET (414 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (236 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 27,
    "body": "*Atendente1 167866231:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 28,
    "body": "*Atendente1 167866231:*\nMensagem por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "status": "sent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "message_id": 27,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 27,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 27,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 28,
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

Versões e exclusão da primeira (message_changes):

```json
[
  {
    "kind": "original",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "edit",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "deletion",
    "origin": "agent",
    "deletion_scope": "everyone"
  }
]
```

Auditoria:

```json
[
  {
    "entity_id": 27,
    "action": "message_edited"
  },
  {
    "entity_id": 27,
    "action": "message_deleted"
  },
  {
    "entity_id": 28,
    "action": "message_deleted"
  }
]
```
