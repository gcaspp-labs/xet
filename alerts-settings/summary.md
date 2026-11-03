# Jornada alerts-settings: FALHOU

Commit `d607c445c708e6cf5210378b22dcbf9e2ed3f32a`, início 2026-11-03T22:09:23.722Z, duração 6 s.

### Passos

1. ok: Preparar supervisor com número desconectado (361 ms)
2. ok: Sem prompt ao abrir; solicitar só ao ativar e explicar permissão negada (481 ms): `01-permissao-negada.png`
3. ok: No celular de 375 px e no tema escuro o motivo permanece acessível (805 ms): `02-mobile-escuro.png`
4. ok: Contexto inseguro explica HTTPS e mantém o som disponível (919 ms): `03-contexto-inseguro.png`
5. FALHOU: Título inclui número desconectado; conectar zera, sair restaura o título (7 ms)

### Falha

```text
Error: Pré-condição não atendida (celular simulado: pair): HTTP 409 sector is not pairing

    at Journey.apiOk (file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:166:13)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-settings.mjs:51:5
    at async Journey.step (file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-settings.mjs:50:3
    at async journey (file:///home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-settings.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       12166         965        1784        4408        3255
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2097108 988708  30820 4483360   28   94  8221   933 8224    8  7  3 87  3  0  0
 1  0 2097108 978352  30956 4481604    0    0     0   916 9682 11285  8  3 89  0  0  0
 1  0 2097108 985564  30980 4481612    0    0     0   228 8238 8448  8  2 90  0  0  0
```
