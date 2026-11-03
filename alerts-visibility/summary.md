# Jornada alerts-visibility: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:19.994Z, duração 3 s.

### Passos

1. ok: Preparar atendente com notificação ativada (404 ms)
2. ok: Aba fica visível assim que o novo chamado aparece, antes dos 500 ms (1204 ms): `01-aba-visivel.png`
3. ok: Estado final no banco; aba já visível não deve notificar (123 ms)

### Estado final observado

Visibilidade no momento de criar a notificação:

```json
[]
```

Estado final no banco, setor 3:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```
