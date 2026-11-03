# Jornada alerts-visibility: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:27.761Z, duração 4 s.

### Passos

1. ok: Preparar atendente com notificação ativada (440 ms)
2. ok: Aba fica visível assim que o novo chamado aparece, antes dos 500 ms (1206 ms): `01-aba-visivel.png`
3. ok: Estado final no banco; aba já visível não deve notificar (135 ms)

### Estado final observado

Visibilidade no momento de criar a notificação:

```json
[]
```

Estado final no banco, setor 4:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```
