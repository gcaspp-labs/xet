# Jornada correcao-provisoria: FALHOU

Commit `8e64d5223da91ef529c51ea88e4f19df9c948751`, início 2026-11-13T01:38:29.590Z, duração 26 s.

### Passos

1. ok: Assumir e encerrar um chamado (1877 ms)
2. FALHOU: Corrigir assunto e escolher módulo para a lista (20530 ms): `01-escolha-modulo-correcao.png`

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Corrigir atendimento' }).getByText('Patrimônio', { exact: true }).last()
    - locator resolved to <label id="base-ui-_r_18_-label" class="flex items-center gap-2">…</label>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not visible
    - retrying click action
      - waiting 100ms
    39 × waiting for element to be visible, enabled and stable
       - element is not visible
     - retrying click action
       - waiting 500ms

    at /home/thiagocalazans/code/xet-implementer/.worktrees/issue-150/.verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:41:65
    at async Journey.step (/home/thiagocalazans/code/xet-implementer/.worktrees/issue-150/scripts/verify/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-implementer/.worktrees/issue-150/.verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:32:3
    at async journey (/home/thiagocalazans/code/xet-implementer/.worktrees/issue-150/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/.worktrees/issue-150/.verify-app/runs/run-20261112-223704/evidence/correcao-provisoria.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        6192        3427         675        6856        9229
Swap:           2047         299        1748

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 306220 3509448 411232 6609812    0   11   380  1520 9077    8 14  3 83  1  0  0
 2  0 306220 3506972 411232 6612092    0    0     0     0 6631 6579 10  1 88  0  0  0
 2  0 306220 3513024 411232 6611968    0    0     0     0 8739 10971 12  2 86  0  0  0
```
