# Jornada edit-delete-messages-chamados: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:56.977Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado com um atendente (317 ms)
2. ok: Mensagem do cliente chega à fila (8 ms)
3. ok: Atendente assume e responde duas vezes (359 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (261 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (492 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (463 ms): `04-mensagem-editada.png`
7. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (441 ms): `05-janela-de-exclusao.png`
8. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (665 ms): `06-mensagem-ocultada.png`
9. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (214 ms): `07-alteracao-externa.png`
10. ok: Estado final no banco (119 ms)

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
    "body": "*Atendente1 776978860:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 776978860:*\nMensagem enviada por engano",
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
    "kind": "delete_local",
    "status": "accepted"
  }
]
```
