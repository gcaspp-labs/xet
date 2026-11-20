# Jornada atendimentos-message-revisions: PASSOU

Commit `b42f9621ad6d5197287a52a0fa7f075de6d6d341`, início 2026-11-20T13:03:24.763Z, duração 5 s.

### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (1014 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (474 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (37 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (307 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: Duas sessões: a edição e a exclusão externas atualizam a ficha e as versões abertas, sem recarregar (1607 ms): `03-edicao-externa-em-duas-sessoes.png`, `04-segunda-sessao-edicao-externa.png`, `05-exclusao-externa-em-duas-sessoes.png`, `06-segunda-sessao-exclusao-externa.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (233 ms)
7. ok: Estado final no banco (437 ms)

### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":1,\"external_message_id\":\"VERIFY-804767838\",\"body\":\"Preciso do boleto de novembro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":2,\"external_message_id\":\"fake-msg-11fc6cb6-045e-4954-9466-7d81478c04d3\",\"body\":\"*Atendente1 804764884:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 1:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de novembro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 2:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 804764884:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 804764884:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```
