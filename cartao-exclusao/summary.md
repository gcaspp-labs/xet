# Jornada cartao-exclusao: PASSOU

Commit `af10af6f43a505740699b0b6bc7cccfe098f59d2`, início 2026-11-21T23:01:40.544Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, o cliente do chamado e o contato do cartão (721 ms)
2. ok: Mensagem do cliente chega à fila (17 ms)
3. ok: Atendente assume o chamado pela fila (147 ms)
4. ok: Envia o cartão de contato pela janela "Enviar contato" (774 ms): `01-cartao-enviado.png`
5. ok: O menu do cartão explica que não pode ser editado e oferece Excluir (348 ms): `02-menu-do-cartao.png`
6. ok: Excluir para todos deixa o aviso "Mensagem excluída no XET" (399 ms): `03-janela-de-exclusao.png`, `04-aviso-de-exclusao.png`
7. ok: Com o número desconectado, o cartão com falha só aceita "Excluir para mim" (1187 ms): `05-menu-do-cartao-com-falha.png`, `06-cartao-com-falha-excluido-para-mim.png`
8. ok: Em Atendimentos, o cartão fica guardado e "Ver exclusão" mostra o cartão (549 ms): `07-atendimentos-ver-exclusao.png`
9. ok: Estado final no banco (218 ms)

### Estado final observado

Mensagens de contato do chamado:

```json
[
  {
    "type": "contact",
    "status": "sent",
    "tem_cartao": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent"
  },
  {
    "type": "contact",
    "status": "failed",
    "tem_cartao": true,
    "deletion_scope": "local",
    "deletion_origin": "agent"
  }
]
```

Ações de mensagem registradas:

```json
[
  {
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "kind": "delete_local",
    "status": "accepted"
  }
]
```
