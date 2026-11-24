# Jornada edit-delete-sent-message: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:03:01.836Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (411 ms)
2. ok: Mensagem do cliente chega à fila (18 ms)
3. ok: Atendente assume e responde (337 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (9 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (184 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (102 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (11 ms)
8. ok: Segunda mensagem é excluída só no XET (315 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (242 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 19,
    "body": "*Atendente1 781836107:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 20,
    "body": "*Atendente1 781836107:*\nMensagem por engano",
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
    "message_id": 19,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 19,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 19,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 20,
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
    "entity_id": 19,
    "action": "message_edited"
  },
  {
    "entity_id": 19,
    "action": "message_deleted"
  },
  {
    "entity_id": 20,
    "action": "message_deleted"
  }
]
```
