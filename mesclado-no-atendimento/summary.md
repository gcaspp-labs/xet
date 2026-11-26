# Jornada mesclado-no-atendimento: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:27.169Z, duração 3 s.

### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (817 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (338 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (226 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (335 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (197 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (190 ms)

### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":19}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```
