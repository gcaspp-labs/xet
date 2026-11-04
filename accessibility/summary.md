# Jornada accessibility: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:38.182Z, duração 11 s.

### Passos

1. ok: Preparar setor, módulos e dois chamados (433 ms)
2. ok: Tamanhos Padrão, Grande e Maior mudam o texto e persistem (1444 ms): `01-painel-maior.png`
3. ok: Alto contraste e tamanho aplicados antes do JavaScript do app (547 ms)
4. ok: Preferências chegam a outra aba com o menu fechado (1208 ms)
5. ok: Painel, menu e sino medidos em 7:1 — Claro (781 ms): `02-menu-Claro.png`, `03-sino-Claro.png`
6. ok: Painel, menu e sino medidos em 7:1 — Escuro (776 ms): `04-menu-Escuro.png`, `05-sino-Escuro.png`
7. ok: Abrir e assumir em Maior, título e ações acessíveis (376 ms): `06-conversa-maior.png`
8. ok: Conversa, campos, status e encerramento com erros — Claro (808 ms): `07-encerramento-Claro.png`
9. ok: Conversa, campos, status e encerramento com erros — Escuro (754 ms): `08-encerramento-Escuro.png`
10. ok: 375px, Maior: conversa, sino e encerramento sem rolagem horizontal (565 ms): `09-celular-conversa.png`, `10-celular-sino.png`, `11-celular-encerramento.png`
11. ok: Número desconectado com palavra e contraste nos dois temas (1300 ms): `12-desconectado-Claro.png`, `13-conexao-Claro.png`, `14-desconectado-Escuro.png`, `15-conexao-Escuro.png`
12. ok: Sistema escuro e claro forçado preservam alto contraste (467 ms)
13. ok: Estado final no banco: chamado e mensagem preservados (120 ms)

### Estado final observado

Painel Claro:

```json
{
  "failures": [],
  "measured": 47
}
```

Menu Claro:

```json
{
  "failures": [],
  "measured": 61
}
```

Foco sino Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Sino Claro:

```json
{
  "failures": [],
  "measured": 58
}
```

Painel Escuro:

```json
{
  "failures": [],
  "measured": 47
}
```

Menu Escuro:

```json
{
  "failures": [],
  "measured": 61
}
```

Foco sino Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Sino Escuro:

```json
{
  "failures": [],
  "measured": 58
}
```

Conversa Claro:

```json
{
  "failures": [],
  "measured": 66
}
```

Foco mensagem Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Encerramento Claro:

```json
{
  "failures": [],
  "measured": 95
}
```

Foco assunto Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Conversa Escuro:

```json
{
  "failures": [],
  "measured": 66
}
```

Foco mensagem Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Encerramento Escuro:

```json
{
  "failures": [],
  "measured": 95
}
```

Foco assunto Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Sino desconectado Claro:

```json
{
  "failures": [],
  "measured": 73
}
```

Conexão Claro:

```json
{
  "failures": [],
  "measured": 23
}
```

Sino desconectado Escuro:

```json
{
  "failures": [],
  "measured": 31
}
```

Conexão Escuro:

```json
{
  "failures": [],
  "measured": 23
}
```

Chamados:

```json
[
  {
    "id": 4,
    "status": "in_progress",
    "assignee_id": 4
  },
  {
    "id": 5,
    "status": "queued",
    "assignee_id": null
  }
]
```
