# Jornada new-ticket-scroll: PASSOU

Commit `e55dbfa75b3bfd28c214f2500ebfd9b78a81656d`, início 2026-11-17T03:06:05.963Z, duração 3 s.

### Passos

1. ok: Preparar setor e 23 contatos fictícios (1078 ms)
2. ok: Abrir Novo chamado e buscar pelo marcador: 20 contatos, sem rodapé (348 ms): `01-vinte-primeiros.png`
3. ok: Rolar até o fim: aparecem os 23 (172 ms): `02-vinte-e-tres.png`
4. ok: Mudar a busca volta à página 1 e ao topo (211 ms): `03-busca-reiniciada.png`
5. ok: Estado final no banco (284 ms)

### Estado final observado

Contatos do marcador:

```json
[
  {
    "count": 23
  }
]
```

Chamados criados:

```json
[
  {
    "count": 0
  }
]
```
