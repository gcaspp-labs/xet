# Jornada alerts-visibility: FALHOU

Commit `d607c445c708e6cf5210378b22dcbf9e2ed3f32a`, início 2026-11-03T22:09:53.960Z, duração 6 s.

### Passos

1. ok: Preparar atendente com notificação ativada (434 ms)
2. ok: Aba fica visível assim que o novo chamado aparece, antes dos 500 ms (1212 ms): `01-aba-visivel.png`
3. FALHOU: Estado final no banco; aba já visível não deve notificar (146 ms)

### Falha

```text
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Karla Retorno",
+ ]
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toEqual (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-visibility.mjs:33:28
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-visibility.mjs:31:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-visibility.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       12112        1010        1780        4413        3309
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2097108 1034540  33396 4485788   28   94  8215   933 8226    8  7  3 87  3  0  0
 1  0 2097108 1017896  33560 4483868    0    0     0   908 10491 11516  8  2 89  0  0  0
 3  0 2097108 1001932  33568 4484020    0    0   132   496 8985 10167 10  2 88  0  0  0
```

### Estado final observado

Visibilidade no momento de criar a notificação:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Karla Retorno",
    "tag": "ticket-11",
    "visibility": "visible"
  }
]
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
