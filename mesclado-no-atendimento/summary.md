# Jornada mesclado-no-atendimento: PASSOU

Commit `aa09564d7aea99cb7da77839deed4ed2fb21d789`, início 2026-11-25T00:15:23.353Z, duração 2 s.

### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (480 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (184 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (175 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (241 ms): `03-ficha-do-mesclado.png`
5. ok: Estado final no banco (121 ms)

### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":9}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```
