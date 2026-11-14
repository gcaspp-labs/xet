# Jornada connection: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:15:37.951Z, duração 28 s.

### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (415 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (552 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (328 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (421 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (383 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (418 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (932 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (638 ms): `09-numero-de-outro-setor.png`
9. FALHOU: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (20582 ms)

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
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/connection.mjs:129:78
    at async Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/connection.mjs:125:3
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/connection.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        8089        2752         916        5917        7332
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 2096708 2818904 304256 5755392    6   32   980   959 5087    4  6  1 91  1  0  0
 0  0 2096708 2815908 304256 5755292    0    0     0     4 4713 5975  2  1 97  0  0  0
 0  0 2096708 2816368 304256 5755268    0    0     0     0 4565 5772  2  1 97  0  0  0
```
