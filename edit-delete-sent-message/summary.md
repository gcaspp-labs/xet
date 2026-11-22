# Jornada edit-delete-sent-message: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:31.038Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (588 ms)
2. ok: Mensagem do cliente chega à fila (41 ms)
3. ok: Atendente assume e responde (445 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (19 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (206 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (169 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (31 ms)
8. ok: Segunda mensagem é excluída só no XET (437 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (441 ms)

### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 7,
    "body": "*Atendente1 931039596:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 8,
    "body": "*Atendente1 931039596:*\nMensagem por engano",
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
    "message_id": 7,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 7,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 7,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 8,
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
    "entity_id": 7,
    "action": "message_edited"
  },
  {
    "entity_id": 7,
    "action": "message_deleted"
  },
  {
    "entity_id": 8,
    "action": "message_deleted"
  }
]
```
