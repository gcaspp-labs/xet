# Jornada receive-and-assign: FALHOU

Commit `0e40068d3fa857f5f5ed1f20a14739cecfff8315`, início 2026-11-13T22:19:27.914Z, duração 24 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (611 ms)
2. FALHOU: Atendente entra e vê a fila vazia (20023 ms)

### Falha

```text
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Atendimento' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Atendimento' }) with timeout 20000ms
  - waiting for getByRole('heading', { name: 'Atendimento' })

    at captureRawStack (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toBeVisible (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:17:75
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:16:11
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/receive-and-assign.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        8170        3840         908        4947        7252
Swap:           2047        1534         513

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 1570892 3933164 108520 4958196    8   36  1274  1191 5631    5  7  2 90  1  0  0
 0  0 1570892 3934848 108520 4958136    0    0     0    12 4827 5844  1  1 98  0  0  0
 0  0 1570892 3934944 108532 4958296    0    0     0   248 6081 7769  2  1 97  0  0  0
```
