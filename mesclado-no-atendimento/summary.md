# Jornada mesclado-no-atendimento: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:53.298Z, duração 2 s.

### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (484 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (230 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (183 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (230 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (122 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (118 ms)

### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":25}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```
