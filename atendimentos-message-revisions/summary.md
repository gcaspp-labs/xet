# Jornada atendimentos-message-revisions: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:19.048Z, duração 3 s.

### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (541 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (280 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (25 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (172 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1205 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (210 ms)
7. ok: Estado final no banco (229 ms)

### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":7,\"external_message_id\":\"VERIFY-139052518\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":8,\"external_message_id\":\"fake-msg-de4d9dad-cace-4377-a58d-3556ede40816\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 7:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 8:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 139049140:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```
