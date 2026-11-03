# Jornada alerts-tabs: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:20.220Z, duração 7 s.

### Passos

1. ok: Preparar setor e uma sessão com duas abas (414 ms)
2. ok: Duas abas ligadas: apenas uma notifica o mesmo chamado (1348 ms)
3. ok: Desligar as opções na primeira aba, sem abrir o menu na segunda (2594 ms): `01-opcoes-desligadas.png`, `02-segunda-aba-apos-desligar.png`
4. ok: Estado final no banco e verificação de que a opção desligada vale nas duas abas (163 ms)

### Estado final observado

Alerta inicial em cada aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-13",
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
      "tag": "ticket-13",
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

Estado final no banco, setor 3:

```json
[
  {
    "status": "queued",
    "total": 2
  }
]
```
