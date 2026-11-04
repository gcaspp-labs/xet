# Jornada accessibility-toast: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:33.885Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado (474 ms)
2. ok: Aviso acompanha o tamanho Padrão (540 ms): `01-aviso-Padrão.png`
3. ok: Aviso acompanha o tamanho Grande (531 ms): `02-aviso-Grande.png`
4. ok: Aviso acompanha o tamanho Maior (511 ms): `03-aviso-Maior.png`
5. ok: Aviso cresce 15% e 30% sobre Padrão (1 ms)
6. ok: 375px em Maior: aviso com ação cabe e o link também cresce (781 ms): `04-celular-maior-com-acao.png`, `05-conversa-aberta-pelo-aviso.png`
7. ok: Estado final no banco: três chamados, um assumido (121 ms)

### Estado final observado

Padrão:

```json
{
  "toast": 13,
  "body": "14px"
}
```

Grande:

```json
{
  "toast": 14.95,
  "body": "16.1px"
}
```

Maior:

```json
{
  "toast": 16.9,
  "body": "18.2px"
}
```

Aviso com ação no celular:

```json
{
  "size": 16.9,
  "actionSize": 17.55,
  "box": {
    "x": 16,
    "y": 659.3367309570312,
    "width": 343,
    "height": 60.3125
  },
  "linkBox": {
    "x": 222,
    "y": 671.0186767578125,
    "width": 120,
    "height": 26.3125
  }
}
```

Chamados:

```json
[
  {
    "status": "queued",
    "assignee_id": null
  },
  {
    "status": "queued",
    "assignee_id": null
  },
  {
    "status": "in_progress",
    "assignee_id": 3
  }
]
```
