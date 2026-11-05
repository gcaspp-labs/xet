# Jornada pr71-dialogs: FALHOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:16:07.435Z, duração 12 s.

### Passos

1. ok: Preparar setor, módulo, órgão e contato fictícios (691 ms)
2. ok: Assumir chamado pela tela (457 ms)
3. ok: Encerrar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (3287 ms): `01-encerrar-chamado.png`
4. ok: Transferir para outro setor: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (728 ms): `02-transferir-para-outro-setor.png`
5. ok: Cancelar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (641 ms): `03-cancelar-chamado.png`
6. ok: Devolver à fila: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (535 ms): `04-devolver-à-fila.png`
7. ok: Transferir preserva a escolha do seletor (886 ms): `05-transferir-chamado.png`
8. ok: Cadastro pelo atendimento tem bloqueio e preserva nome (526 ms): `06-cadastrar-contato.png`
9. ok: Cadastro aninhado: Cancelar devolve assunto e resolução; Esc não fecha a origem (769 ms): `07-cadastro-aninhado-bloqueado.png`
10. FALHOU: Combobox seleciona órgão e Esc fecha só a lista (47 ms)

### Falha

```text
locator.click: Error: strict mode violation: getByRole('button', { name: 'Encerrar', exact: true }) resolved to 2 elements:
    1) <button tabindex="0" type="button" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[calc(13px*var(--…>…</button> aka locator('#root').getByRole('button', { name: 'Encerrar' })
    2) <button tabindex="0" type="submit" form="_r_35_" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[ca…>Encerrar</button> aka locator('[id="_r_36_"]').getByRole('button', { name: 'Encerrar' })

Call log:
  - waiting for getByRole('button', { name: 'Encerrar', exact: true })

    at /tmp/xet-revisor-pr71-dialogs.mjs:90:30
    at Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:27)
    at /tmp/xet-revisor-pr71-dialogs.mjs:89:11
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///tmp/xet-revisor-pr71-dialogs.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9458        2396        1667        5568        5963
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2096820 2454164  79560 5622712   28  108   598   884 7021    5  9  2 88  0  0  0
 1  0 2096820 2459236  79560 5622740    0    0     0    12 14220 8405 13  3 84  0  0  0
 2  0 2096820 2469972  79560 5624744    0    0     0     0 13595 8784 12  3 85  0  0  0
```
