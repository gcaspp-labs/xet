# Jornada transfer: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:17:21.382Z, duração 24 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1069 ms)
2. FALHOU: Atendente assume o chamado (20033 ms)

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Joana Cliente' })

    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:24:61
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:23:28
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/transfer.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        7967        2849         908        5934        7454
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2096428 2917828 305620 5771744    6   32   979   959 5088    4  6  1 91  1  0  0
 0  0 2096428 2917084 305640 5771724    0    0     0   252 4880 6024  2  1 96  0  0  0
 0  0 2096428 2916612 305640 5771660    0    0     0     0 4853 6210  4  1 95  0  0  0
```
