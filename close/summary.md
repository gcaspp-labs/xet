# Jornada close: FALHOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:12:13.244Z, duração 30 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (725 ms)
2. ok: Atendente assume o chamado (313 ms)
3. ok: Formulário vazio não encerra e diz o que falta (2995 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (953 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (551 ms)
6. ok: Fim antes do início é recusado (162 ms)
7. FALHOU: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (20244 ms): `03-formulario-completo.png`

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Encerrar chamado' }).getByRole('button', { name: 'Encerrar' })
    - locator resolved to <button tabindex="0" type="submit" form="_r_12_" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[ca…>Encerrar</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    38 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

    at /home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:87:61
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:76:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9502        2362        1663        5554        5919
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2096924 2419344  76964 5610896   28  109   603   885 6959    5  9  2 88  0  0  0
 1  0 2096924 2442104  76964 5607680    0    0     0     0 11823 10435 14  3 83  0  0  0
 2  0 2096924 2437136  76964 5607848    0    0     0     4 12365 10855 12  3 85  0  0  0
```
