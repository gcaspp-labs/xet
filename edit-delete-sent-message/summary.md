# Jornada edit-delete-sent-message: PASSOU

Commit `c2b6621e1f32034dd511bb01fcbe91129d3d02f6`, início 2026-11-26T22:30:56.407Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (705 ms)
2. ok: Mensagem do cliente chega à fila (9 ms)
3. ok: Atendente assume e responde (569 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (26 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (336 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (223 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (21 ms)
8. ok: Segunda mensagem é excluída só no XET (842 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (502 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 6,
    "body": "*Atendente1 256408137:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 7,
    "body": "*Atendente1 256408137:*\nMensagem por engano",
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
    "message_id": 6,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 6,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 6,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 7,
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
    "entity_id": 6,
    "action": "message_edited"
  },
  {
    "entity_id": 6,
    "action": "message_deleted"
  },
  {
    "entity_id": 7,
    "action": "message_deleted"
  }
]
```
