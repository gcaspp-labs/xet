# Jornada receive-and-assign: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:16:33.560Z, duração 24 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (594 ms)
2. FALHOU: Atendente entra e vê a fila vazia (20027 ms)

### Falha

```text
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Atendimentos' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Atendimentos' }) with timeout 20000ms
  - waiting for getByRole('heading', { name: 'Atendimentos' })

    at captureRawStack (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toBeVisible (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:17:76
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:16:11
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        7976        2841         908        5934        7445
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2096428 2909204 305092 5771468    6   32   980   959 5087    4  6  1 91  1  0  0
 0  0 2096428 2910600 305104 5771436    0    0     0   236 5921 6596  4  1 95  0  0  0
 0  0 2096428 2916432 305104 5771792    0    0     0     0 5645 7841  2  1 96  0  0  0
```
