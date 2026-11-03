# Jornada alerts-tabs-return: FALHOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:45.505Z, duração 8 s.

### Passos

1. ok: Preparar duas abas com notificações ligadas (405 ms)
2. FALHOU: Voltar a uma aba antes dos 500 ms; a outra deve permanecer sem notificar (2835 ms): `01-primeira-aba-visivel.png`, `02-segunda-aba-notificou.png`

### Falha

```text
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Retorno Duas Abas",
+ ]
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toEqual (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:59:59
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:18:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       11942         508        1727        5032        3480
Swap:           2047        2041           6

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2090416 521120  97876 5055816   26   87  7789   900 8160    7  7  3 88  3  0  0
 0  0 2090416 520824  97876 5056192    0    0     0     0 6404 7743  3  1 96  0  0  0
 0  0 2090416 519148  97876 5046984    0    0    60    64 8040 10498  4  3 93  0  0  0
```

### Estado final observado

Notificações e retorno à aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Retorno Duas Abas",
      "tag": "ticket-14",
      "visibility": "hidden"
    }
  ],
  "visibilidadePrimeira": "visible",
  "criacaoNaSegunda": {
    "at": 1793747148407,
    "visibleSince": "1793747148047"
  }
}
```

Estado final no banco, setor 9:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```
