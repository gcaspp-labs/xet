# Jornada accessibility-toast: FALHOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:09:33.530Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado (454 ms)
2. ok: Medir aviso de chamado recebido em Padrão (495 ms): `01-aviso-Padrão.png`
3. ok: Medir aviso de chamado recebido em Maior (485 ms): `02-aviso-Maior.png`
4. ok: Estado final no banco (124 ms)
5. FALHOU: Aviso cresce 30% em Maior, como o restante do texto (4 ms)

### Falha

```text
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 1.3
Received: 1

Expected precision:    2
Expected difference: < 0.005
Received difference:   0.30000000000000004
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toBeCloseTo (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:29:29
    at Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:28:10
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       12048         936        1757        4528        3373
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2096456 956900  73604 4563288   24   80  7366   899 8298    7  7  3 87  3  0  0
 0  0 2096456 956384  73604 4563212    0    0     8     0 10008 8709  8  2 90  0  0  0
 0  0 2096456 942136  73604 4561476    0    0     0    16 11038 10714  8  3 89  0  0  0
```

### Estado final observado

Padrão:

```json
{
  "toast": "13px",
  "body": "14px"
}
```

Maior:

```json
{
  "toast": "13px",
  "body": "18.2px"
}
```

Chamados:

```json
[
  {
    "status": "queued"
  },
  {
    "status": "queued"
  }
]
```
