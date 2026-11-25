# Jornada mesclado-no-atendimento: PASSOU

Commit `80337a84009b45c8d6025e059699650d57f9324a`, início 2026-11-25T03:57:32.515Z, duração 2 s.

### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (540 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (211 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (195 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (265 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (164 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (110 ms)

### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":11}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```
