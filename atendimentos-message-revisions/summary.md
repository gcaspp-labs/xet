# Jornada atendimentos-message-revisions: PASSOU

Commit `fa82b91e629bf40a74946817bd3a6aa07f892aa0`, início 2026-11-20T12:22:57.913Z, duração 4 s.

### Passos

1. ok: Preparar um atendimento encerrado com mensagens editadas e excluídas (878 ms)
2. ok: O atendimento encerrado abre em Atendimentos e mostra o conteúdo preservado (540 ms): `01-atendimento-com-conteudo-preservado.png`
3. ok: Somente leitura: nenhuma ação de alterar, restaurar ou reenviar (41 ms)
4. ok: As versões da mensagem do XET por teclado, com a exclusão só no XET (302 ms): `02-versoes-da-mensagem-do-xet.png`
5. ok: A alteração e a exclusão externas, com autor e alcance registrados (273 ms): `03-exclusao-do-cliente.png`
6. ok: Recarregar mantém o conteúdo, as etiquetas e as versões (216 ms)
7. ok: Estado final no banco (434 ms)

### Estado final observado

Mensagens do atendimento:

```json
"[{\"id\":1,\"external_message_id\":\"VERIFY-377917746\",\"body\":\"Preciso do boleto de outubro\",\"edited\":true,\"deletion_scope\":\"everyone\",\"deletion_origin\":\"customer\"},{\"id\":2,\"external_message_id\":\"fake-msg-e4d6f70d-70f4-4c73-a0ef-51e87af9e12a\",\"body\":\"*Atendente1 377914808:*\\nSegue o boleto de outubro\",\"edited\":true,\"deletion_scope\":\"local\",\"deletion_origin\":\"agent\"}]"
```

Versões da mensagem 1:

```json
"[{\"kind\":\"original\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"customer\",\"body\":\"Preciso do boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"customer\",\"body\":null}]"
```

Versões da mensagem 2:

```json
"[{\"kind\":\"original\",\"origin\":\"agent\",\"body\":\"*Atendente1 377914808:*\\nSegue o boleto de setembro\"},{\"kind\":\"edit\",\"origin\":\"agent\",\"body\":\"*Atendente1 377914808:*\\nSegue o boleto de outubro\"},{\"kind\":\"deletion\",\"origin\":\"agent\",\"body\":null}]"
```

Chamado:

```json
"{\"status\":\"closed\",\"closure_type\":\"resolved\"}"
```
