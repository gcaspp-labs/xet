# Jornada pr71-action-overlap: FALHOU

Commit `b6f41b290963c4b86ce4afb9f97c24f377876af1`, início 2026-11-05T02:43:52.855Z, duração 11 s.

### Passos

1. ok: Preparar dois chamados fictícios no mesmo setor (642 ms)
2. ok: Abrir e assumir o primeiro chamado (440 ms)
3. ok: Assumir o segundo pelo sino e abrir Encerrar no primeiro (800 ms): `01-link-sobre-botao-encerrar.png`
4. ok: Com o cursor sobre o link, observar se o bloqueio persiste por 5 segundos (5154 ms): `02-link-persistente-apos-cinco-segundos.png`
5. FALHOU: Clique no trecho coberto do Encerrar deve continuar no mesmo chamado (1067 ms)

### Falha

```text
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/chamados\/3$/
Received string:  "http://127.0.0.1:25173/chamados/4"
Timeout: 1000ms

Call log:
  - Expect "toHaveURL" with timeout 1000ms
    11 × locator resolved to <html lang="pt-BR">…</html>
       - unexpected value "http://127.0.0.1:25173/chamados/4"

    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toHaveURL (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:50:23
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:48:2
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9376        2608        1639        5410        6045
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 4  0 2096452 2671272  80352 5460260   26  101   587   890 7465    6 10  2 87  0  0  0
 2  0 2096452 2671884  80352 5459848    0    0     0    72 11531 10396 14  3 83  0  0  0
 1  0 2096452 2678560  80352 5459800    0    0     0     0 11738 10039 12  4 83  0  0  0
```

### Estado final observado

Link e botão ocupam o mesmo ponto:

```json
{
  "x": 784,
  "y": 510.3168487548828
}
```
