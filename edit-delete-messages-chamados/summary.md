# Jornada edit-delete-messages-chamados: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:12.614Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado com um atendente (381 ms)
2. ok: Mensagem do cliente chega à fila (12 ms)
3. ok: Atendente assume e responde duas vezes (511 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (268 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (548 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (613 ms): `04-mensagem-editada.png`
7. ok: Recusa do WhatsApp: aviso, texto preservado e faixa aberta (684 ms): `05-recusa-do-whatsapp.png`
8. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (546 ms): `06-janela-de-exclusao.png`
9. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (661 ms): `07-mensagem-ocultada.png`
10. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (362 ms): `08-alteracao-externa.png`
11. ok: Estado final no banco (219 ms)

### Estado final observado

Mensagens do chamado:

```json
[
  {
    "body": "Preciso do boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "customer",
    "origin": "customer"
  },
  {
    "body": "*Atendente1 672615505:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 672615505:*\nMensagem enviada por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "origin": "agent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "kind": "edit",
    "status": "accepted"
  },
  {
    "kind": "edit",
    "status": "refused"
  },
  {
    "kind": "delete_local",
    "status": "accepted"
  }
]
```
