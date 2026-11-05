# Jornada pr71-toast-hover: FALHOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:19:51.968Z, duração 16 s.

### Passos

1. ok: Preparar chamado fictício com módulo e órgão (683 ms)
2. ok: Assumir e preencher o encerramento pela tela (3461 ms)
3. ok: Cadastrar o contato dentro do encerramento e voltar ao formulário preenchido (604 ms)
4. ok: Estado no banco antes de encerrar: contato cadastrado e chamado em atendimento (148 ms)
5. FALHOU: Botão Encerrar continua utilizável depois de salvar o contato (7488 ms): `01-cursor-sobre-o-botao-encerrar.png`, `02-aviso-ainda-bloqueia-apos-sete-segundos.png`

### Falha

```text
locator.click: Timeout 7000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Encerrar chamado', exact: true }).getByRole('button', { name: 'Encerrar', exact: true })
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
    13 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <li tabindex="0" data-index="0" data-front="true" data-styled="true" data-mounted="true" data-swiped="false" data-visible="true" data-type="success" data-sonner-toast="" data-promise="false" data-removed="false" data-swiping="false" data-expanded="true" data-swipe-out="false" data-dismissible="true" data-y-position="bottom" data-x-position="center" class="cn-toast body text-[calc(13px*var(--text-scale))]!">…</li> from <div id="root" data-base-ui-inert="">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms

    at /tmp/xet-revisor-pr71-toast-hover.mjs:47:64
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///tmp/xet-revisor-pr71-toast-hover.mjs:42:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///tmp/xet-revisor-pr71-toast-hover.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9404        2441        1669        5579        6017
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 5  0 2096732 2499920  82176 5631380   27  107   592   883 7086    5 10  2 88  0  0  0
 0  0 2096732 2497280  82176 5631440    0    0     0     0 7814 7828 10  2 88  0  0  0
 1  0 2096732 2496568  82176 5631392    0    0     0     0 8721 8157 11  2 87  0  0  0
```

### Estado final observado

Estado antes da ação:

```json
{
  "status": "in_progress",
  "registered": true
}
```

Elemento que recebe o clique no centro do botão:

```json
{
  "button": {
    "x": 767,
    "y": 731.4375,
    "width": 82,
    "height": 36.5625
  },
  "hit": "<li tabindex=\"0\" class=\"cn-toast body text-[calc(13px*var(--text-scale))]!\" data-sonner-toast=\"\" data-styled=\"true\" data-mounted=\"true\" data-promise=\"false\" data-swiped=\"false\" data-removed=\"false\" data-visible=\"true\" data-y-position=\"bottom\" data-x-position=\"center\" data-index=\"0\" data-front=\"true\" data-swiping=\"false\" data-dismissible=\"true\" data-type=\"success\" data-swipe-out=\"false\" data-expanded=\"true\" style=\"--index: 0; --toasts-before: 0; --z-index: 1; --offset: 0px; --initial-height: 53.5px;\"><div data-icon=\"\" class=\"\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-check lucide-check-circle-2 size-4 text-success\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 9-5.5 5.5L8 12\"></path></svg></div><div data-content=\"\" class=\"\"><div data-title=\"\" class=\"\">Contato salvo</div></div></li>",
  "toast": "<li tabindex=\"0\" class=\"cn-toast body text-[calc(13px*var(--text-scale))]!\" data-sonner-toast=\"\" data-styled=\"true\" data-mounted=\"true\" data-promise=\"false\" data-swiped=\"false\" data-removed=\"false\" data-visible=\"true\" data-y-position=\"bottom\" data-x-position=\"center\" data-index=\"0\" data-front=\"true\" data-swiping=\"false\" data-dismissible=\"true\" data-type=\"success\" data-swipe-out=\"false\" data-expanded=\"true\" style=\"--index: 0; --toasts-before: 0; --z-index: 1; --offset: 0px; --initial-height: 53.5px;\"><div data-icon=\"\" class=\"\"><svg xmlns=\"http://www.w3.org/2000/svg\" width=\"24\" height=\"24\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"lucide lucide-circle-check lucide-check-circle-2 size-4 text-success\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 9-5.5 5.5L8 12\"></path></svg></div><div data-content=\"\" class=\"\"><div data-title=\"\" class=\"\">Contato salvo</div></div></li>"
}
```

Estado final no banco após a tentativa:

```json
[
  {
    "status": "in_progress"
  }
]
```
