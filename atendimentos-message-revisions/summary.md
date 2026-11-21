# Jornada atendimentos-message-revisions: PASSOU

Commit `af10af6f43a505740699b0b6bc7cccfe098f59d2`, início 2026-11-21T23:01:16.524Z, duração 5 s.

### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (929 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (464 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (42 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (337 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1612 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (257 ms)
7. ok: Estado final no banco (465 ms)

### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":4,\"external_message_id\":\"VERIFY-076528269\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":5,\"external_message_id\":\"fake-msg-c691a286-efd8-470e-9b5f-b9d34909f7ac\",\"body\":\"*Atendente1 076525103:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 4:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 5:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 076525103:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 076525103:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```
