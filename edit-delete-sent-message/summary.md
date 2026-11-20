# Jornada edit-delete-sent-message: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:28:55.886Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (1223 ms)
2. ok: Mensagem do cliente chega à fila (45 ms)
3. ok: Atendente assume e responde (549 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (30 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (330 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (195 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (33 ms)
8. ok: Segunda mensagem é excluída só no XET (621 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (1079 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 18,
    "body": "*Atendente1 135886023:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 19,
    "body": "*Atendente1 135886023:*\nMensagem por engano",
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
    "message_id": 18,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 18,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 18,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 19,
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
    "entity_id": 18,
    "action": "message_edited"
  },
  {
    "entity_id": 18,
    "action": "message_deleted"
  },
  {
    "entity_id": 19,
    "action": "message_deleted"
  }
]
```
