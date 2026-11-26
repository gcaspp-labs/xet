# Jornada edit-delete-sent-message: PASSOU

Commit `8f8b5ee8fcdd10cbbffa936e87ef555db454ff27`, início 2026-11-26T07:47:13.189Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (565 ms)
2. ok: Mensagem do cliente chega à fila (16 ms)
3. ok: Atendente assume e responde (478 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (19 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (240 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (160 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (17 ms)
8. ok: Segunda mensagem é excluída só no XET (502 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (417 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 10,
    "body": "*Atendente1 233189518:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 11,
    "body": "*Atendente1 233189518:*\nMensagem por engano",
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
    "message_id": 10,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 10,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 10,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 11,
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
    "entity_id": 10,
    "action": "message_edited"
  },
  {
    "entity_id": 10,
    "action": "message_deleted"
  },
  {
    "entity_id": 11,
    "action": "message_deleted"
  }
]
```
