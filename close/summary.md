# Jornada close: FALHOU

Commit `f3286563628bb7afb2a994df5a905d83ac57007b`, início 2026-11-11T20:59:25.079Z, duração 26 s.

### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (523 ms)
2. ok: Atendente assume o chamado (353 ms)
3. ok: Formulário vazio não encerra e diz o que falta (370 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (638 ms): `02-contato-sem-cadastro.png`
5. FALHOU: Atendente cadastra o contato pelo próprio formulário (20014 ms)

### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Encerrar chamado' }).getByRole('button', { name: 'Cadastrar contato' })

    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/close.mjs:61:68
    at Journey.step (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/close.mjs:60:11
    at async journey (/home/thiagocalazans/code/xet-implementer/scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-implementer/scripts/verify/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        6148        3563         682        6750        9273
Swap:           2047         201        1846

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 206676 3648980 193720 6718876    5   20   263   589 5739    5  6  2 91  1  0  0
 0  0 206676 3648320 193720 6719308    0    0     0     0  917 1254  0  0 100  0  0  0
 0  0 206676 3649604 193720 6719308    0    0     0     0  633  910  0  0 100  0  0  0
```
