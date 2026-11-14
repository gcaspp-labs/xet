# Jornada remover-notas-falou-com: PASSOU

Commit `41bfc8b5efdbd45caf451dc81054132ec7359eab`, início 2026-11-14T12:25:43.869Z, duração 6 s.

### Passos

1. ok: Preparar setor, órgão e um chamado na fila (498 ms)
2. ok: Assume pela tela Chamados; sem Notas nem Falou com (460 ms): `01-chamados-assumido.png`
3. ok: Devolver à fila e Transferir sem "notas" no texto (783 ms): `02-devolver.png`, `03-transferir.png`
4. ok: Tela do chamado aberto: só Detalhes e Histórico, sem campo Falou com; rotas somem (284 ms): `04-chamado-aberto-detalhes.png`
5. ok: Cadastra o contato e encerra (1386 ms)
6. ok: Encerrado: Detalhes sem Falou com; Corrigir sem o campo (915 ms): `05-encerrado-detalhes.png`, `06-corrigir.png`, `07-historico-alteracoes.png`
7. ok: Estado final no banco (357 ms)

### Estado final observado

Correção gravada:

```json
[
  {
    "changes": "{\"subject\": {\"to\": \"Segunda via do contracheque\", \"from\": \"Contracheque\"}}"
  }
]
```

Notas gravadas:

```json
[
  {
    "count": 0
  }
]
```
