# Jornada alerts-tabs: FALHOU

Commit `d607c445c708e6cf5210378b22dcbf9e2ed3f32a`, início 2026-11-03T22:09:30.137Z, duração 23 s.

### Passos

1. ok: Preparar setor e uma sessão com duas abas (393 ms)
2. ok: Duas abas ligadas: apenas uma notifica o mesmo chamado (1355 ms)
3. ok: Desligar as opções na primeira aba, sem abrir o menu na segunda (15854 ms): `01-opcoes-desligadas.png`, `02-segunda-aba-apos-desligar.png`
4. FALHOU: Estado final no banco e verificação de que a opção desligada vale nas duas abas (125 ms)

### Falha

```text
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 0
+ Received  + 1

  Array [
    "Iara Única",
+   "Joana Após Desligar",
  ]
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toEqual (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-tabs.mjs:45:17
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-tabs.mjs:42:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-190532/alerts-tabs.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       12202         925        1784        4412        3219
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 3  0 2097108 948044  32332 4485696   28   94  8217   932 8225    8  7  3 87  3  0  0
 0  0 2097108 943992  32344 4486780    0    0  1076   252 9546 12361  8  3 90  0  0  0
 0  0 2097108 956200  32344 4486172    0    0     0     0 9322 10775  8  3 89  0  0  0
```

### Estado final observado

Alerta inicial em cada aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-9",
      "visibility": "hidden"
    }
  ]
}
```

Alertas efetivos após desligar nas Configurações:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-9",
      "visibility": "hidden"
    },
    {
      "title": "Chamado recebido",
      "body": "Joana Após Desligar",
      "tag": "ticket-10",
      "visibility": "hidden"
    }
  ],
  "somPrimeira": 0,
  "somSegunda": 2,
  "armazenamento": {
    "browser": null,
    "sound": null
  }
}
```

Estado final no banco, setor 3:

```json
[
  {
    "status": "queued",
    "total": 2
  }
]
```
