# Jornada consult-subjects: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:16:06.098Z, duração 24 s.

### Passos

1. ok: Preparar setor, assuntos e dois chamados (530 ms)
2. FALHOU: Assumir chamado e consultar soluções ao lado do chat (20045 ms)

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Cecília Consulta' })

    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/consult-subjects.mjs:45:66
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/consult-subjects.mjs:42:25
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/consult-subjects.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        7974        2844         907        5933        7447
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 2096428 2912768 304572 5770940    6   32   980   959 5087    4  6  1 91  1  0  0
 0  0 2096428 2911116 304592 5770920    0    0     0   328 4864 6032  2  1 97  0  0  0
 0  0 2096428 2913020 304592 5770960    0    0     0     0 4650 5956  2  1 97  0  0  0
```
