# Jornada receive-and-assign: FALHOU

Commit `995ce9e40e053e0a14ad233708ebe0fa446cd3c8`, início 2026-11-13T22:58:07.738Z, duração 24 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (576 ms)
2. FALHOU: Atendente entra e vê a fila vazia (20025 ms)

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
Mem.:          15422        8053        3698         898        5197        7368
Swap:           2047        1568         479

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 1606448 3787544 138364 5184304    8   36  1248  1172 5641    5  7  2 90  1  0  0
 0  0 1606448 3793332 138364 5184252    0    0     0    56 5071 5846  2  1 97  0  0  0
 2  0 1606448 3788352 138376 5184288    0    0     0   236 6698 8997  4  1 95  0  0  0
```
