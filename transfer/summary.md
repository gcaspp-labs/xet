# Jornada transfer: FALHOU

Commit `73d1edf61a12b80c5c2e36a620379e77b4b5ff02`, início 2026-11-13T16:19:47.231Z, duração 26 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1087 ms)
2. ok: Atendente assume o chamado (413 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (251 ms): `01-colega-antes.png`
4. FALHOU: Responsável transfere para o colega e perde a resposta (20533 ms): `02-escolher-destino.png`

### Falha

```text
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Conversa', exact: true })
Expected substring: "Chamado com Atendente2 787232683. Peça a transferência"
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Conversa', exact: true }) with timeout 20000ms
  - waiting for getByRole('region', { name: 'Conversa', exact: true })

    at captureRawStack (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toContainText (/home/thiagocalazans/code/xet-implementer/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:59:32
    at async Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:45:3
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9894         304        1158        6715        5527
Swap:           2047        2039           8

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  2 2088112 311288 117044 6760168    6   38   303   984 5059    4  7  1 91  1  0  0
 2  1 2088092 368028 118280 6799908   12    0  8648  1220 26860 56764  5  7 74 14  0  0
 0  1 2088092 298632 132900 6836884    0    0 14604   296 32585 80373  6  8 80  6  0  0
```
