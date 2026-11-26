# Jornada edit-delete-sent-message: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:19.348Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (563 ms)
2. ok: Mensagem do cliente chega à fila (23 ms)
3. ok: Atendente assume e responde (432 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (19 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (209 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (142 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (20 ms)
8. ok: Segunda mensagem é excluída só no XET (481 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (438 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 21,
    "body": "*Atendente1 679348363:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 22,
    "body": "*Atendente1 679348363:*\nMensagem por engano",
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
    "message_id": 21,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 21,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 21,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 22,
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
    "entity_id": 21,
    "action": "message_edited"
  },
  {
    "entity_id": 21,
    "action": "message_deleted"
  },
  {
    "entity_id": 22,
    "action": "message_deleted"
  }
]
```
