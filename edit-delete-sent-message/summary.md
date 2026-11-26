# Jornada edit-delete-sent-message: PASSOU

Commit `79743f434020df3f335acecca04d65c9cc7d67c7`, início 2026-11-26T02:03:48.985Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (579 ms)
2. ok: Mensagem do cliente chega à fila (9 ms)
3. ok: Atendente assume e responde (476 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (14 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (247 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (137 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (23 ms)
8. ok: Segunda mensagem é excluída só no XET (638 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (464 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 49,
    "body": "*Atendente1 628986393:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 50,
    "body": "*Atendente1 628986393:*\nMensagem por engano",
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
    "message_id": 49,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 49,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 49,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 50,
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
    "entity_id": 49,
    "action": "message_edited"
  },
  {
    "entity_id": 49,
    "action": "message_deleted"
  },
  {
    "entity_id": 50,
    "action": "message_deleted"
  }
]
```
