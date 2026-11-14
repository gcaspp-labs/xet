# Jornada transfer: FALHOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:53:03.019Z, duração 24 s.

### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1040 ms)
2. FALHOU: Atendente assume o chamado (20021 ms)

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
Mem.:          15422        9639        3377         861        3651        5782
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2097060 3458604  68620 3670740    6   25   793   851 5079    4  6  1 91  1  0  0
 0  0 2097060 3457640  68632 3670644    0    0     0   160 1063 1611  0  0 99  0  0  0
 0  0 2097060 3458300  68632 3670644    0    0     0     0 1127 1816  1  0 99  0  0  0
```
