# Jornada alerts-tabs-return: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:29:48.453Z, duração 12 s.

### Passos

1. ok: Preparar duas abas com notificações e som ligados (432 ms)
2. ok: Retorno antes dos 500 ms cancela a notificação na outra aba; som único (2629 ms): `01-retorno-aba-visivel.png`, `02-outra-aba-sem-notificar.png`
3. ok: Aba visível recebe a fila 1,5 s depois; a outra não notifica e som segue único (2809 ms): `03-aba-visivel-lenta.png`
4. ok: Ocultar ambas restaura uma notificação e um som por chamado (1697 ms)
5. ok: Fechar a aba visível libera a trava; aba restante volta a notificar (1108 ms): `04-aba-visivel-fechada.png`
6. ok: Estado final no banco (131 ms)

### Estado final observado

Retorno, som e notificações:

```json
{
  "visibilidade": "visible",
  "som": 1,
  "notificacoes": []
}
```

Aba lenta:

```json
{
  "som": 2,
  "notificacoes": []
}
```

Notificações registradas durante toda a jornada:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Controle Ocultas",
      "tag": "ticket-3",
      "visibility": "hidden"
    }
  ],
  "som": 3
}
```

Estado final no banco, setor 1:

```json
[
  {
    "status": "queued",
    "total": 4
  }
]
```
