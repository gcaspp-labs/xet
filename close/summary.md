# Jornada close: FALHOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:52:39.214Z, duração 23 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (468 ms)

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
Mem.:          15422        9665        3352         863        3652        5756
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 2097060 3433384  68280 3671804    6   25   793   851 5079    4  6  1 91  1  0  0
 0  0 2097060 3432716  68300 3672664    0    0   436   304 1325 1956  1  0 99  0  0  0
 0  0 2097060 3438184  68300 3672280    0    0     0    56 2298 3593  1  1 98  0  0  0
```
