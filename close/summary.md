# Jornada close: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:15:14.008Z, duração 24 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (546 ms)

### Falha

```text
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Realizados hoje' })
Expected substring: "Nenhum atendimento realizado hoje."
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Realizados hoje' }) with timeout 20000ms
  - waiting for getByRole('region', { name: 'Realizados hoje' })

    at captureRawStack (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toContainText (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/close.mjs:20:32
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        7968        2876         906        5906        7453
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 2096912 2944916 303924 5744020    6   32   980   959 5087    4  6  1 91  1  0  0
 0  0 2096912 2950736 303924 5744076    0    0     0     0 6189 7929  3  1 96  0  0  0
 1  0 2096912 2952664 303936 5744100    0    0     0 39324 5832 6533  3  1 96  0  0  0
```
