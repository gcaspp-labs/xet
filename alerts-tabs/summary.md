# Jornada alerts-tabs: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:12.697Z, duração 7 s.

### Passos

1. ok: Preparar setor e uma sessão com duas abas (435 ms)
2. ok: Duas abas ligadas: apenas uma notifica o mesmo chamado (1350 ms)
3. ok: Desligar as opções na primeira aba, sem abrir o menu na segunda (2531 ms): `01-opcoes-desligadas.png`, `02-segunda-aba-apos-desligar.png`
4. ok: Estado final no banco e verificação de que a opção desligada vale nas duas abas (142 ms)

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
    }
  ],
  "somPrimeira": 0,
  "somSegunda": 1,
  "armazenamento": {
    "browser": null,
    "sound": null
  }
}
```

Estado final no banco, setor 2:

```json
[
  {
    "status": "queued",
    "total": 2
  }
]
```
