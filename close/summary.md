# Jornada close: FALHOU

Commit `27f483034078a4d4419e2a251efa3ac176466587`, início 2026-11-05T10:50:49.043Z, duração 52 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (338 ms)

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Entrar' })
    - locator resolved to <button tabindex="0" type="submit" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[calc(13px*var(--…>Entrar</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

    at Journey.signIn (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:137:56)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:18:26
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        4267        6373         772        5886       11154
Swap:           2047           0        2047

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  1      0 6526176 253844 5774364    0    0  6767  1206 7777    6  4  2 92  2  0  0
 2  1      0 6526288 253844 5774088    0    0     0     0 8284 16625  4  2 87  7  0  0
 1  1      0 6527176 253844 5773928    0    0     0     0 6610 11434  2  2 90  7  0  0
```
