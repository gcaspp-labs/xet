# Jornada mesclado-no-atendimento: PASSOU

Commit `b7a83fd8486710280f663fa9b13fef5546e1ae2c`, início 2026-11-25T00:27:09.578Z, duração 2 s.

### Passos

1. ok: Preparar um atendimento encerrado mesclado num chamado pendente (560 ms)
2. ok: Atendimentos: o mesclado aparece com a situação Mesclado e o link para o original (203 ms): `01-lista-com-mesclado.png`
3. ok: O link da lista abre o chamado original, já encerrado, em Atendimentos (176 ms): `02-original-em-atendimentos.png`
4. ok: A ficha do mesclado só avisa a mesclagem, com o link, sem conversa e sem Corrigir (290 ms): `03-ficha-do-mesclado.png`
5. ok: O histórico do contato mostra o mesclado com a situação Mesclado (184 ms): `04-historico-do-contato.png`
6. ok: Estado final no banco (113 ms)

### Estado final observado

Chamado mesclado (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"merged\",\"merged_into_ticket_id\":1}]"
```

Chamado original (banco):

```json
"[{\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Comprovante de férias\"}]"
```
