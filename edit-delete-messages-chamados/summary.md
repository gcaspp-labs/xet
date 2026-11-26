# Jornada edit-delete-messages-chamados: PASSOU

Commit `c2b6621e1f32034dd511bb01fcbe91129d3d02f6`, início 2026-11-26T22:30:45.785Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado com um atendente (594 ms)
2. ok: Mensagem do cliente chega à fila (40 ms)
3. ok: Atendente assume e responde duas vezes (760 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (321 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (723 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (706 ms): `04-mensagem-editada.png`
7. ok: Recusa do WhatsApp: aviso, texto preservado e faixa aberta (796 ms): `05-recusa-do-whatsapp.png`
8. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (579 ms): `06-janela-de-exclusao.png`
9. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (934 ms): `07-mensagem-ocultada.png`
10. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (389 ms): `08-alteracao-externa.png`
11. ok: Estado final no banco (260 ms)

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
    "body": "*Atendente1 245786412:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 245786412:*\nMensagem enviada por engano",
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
