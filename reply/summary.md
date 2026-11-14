# Jornada reply: FALHOU

Commit `441341552e11cd7471280b3ab039ac207160a5ac`, início 2026-11-14T07:16:57.565Z, duração 23 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (450 ms)
2. FALHOU: Sem assumir, não há como responder (20032 ms)

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Carla Cliente' })

    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/reply.mjs:23:66
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/reply.mjs:22:28
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/reply.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        7963        2854         907        5934        7459
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2096428 2922880 305388 5771452    6   32   979   959 5088    4  6  1 91  1  0  0
 0  0 2096428 2920032 305400 5771640    0    0     0   180 5013 5970  2  1 97  0  0  0
 0  0 2096428 2918536 305400 5771784    0    0     0    28 4931 6266  2  1 97  0  0  0
```
