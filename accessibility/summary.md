# Jornada accessibility: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:07:56.125Z, duração 10 s.

### Passos

1. ok: Preparar setor, módulos e dois chamados (551 ms)
2. ok: Tamanhos Padrão, Grande e Maior mudam o texto e persistem (1607 ms): `01-painel-maior.png`
3. ok: Alto contraste e tamanho aplicados antes do JavaScript do app (544 ms)
4. ok: Preferências chegam a outra aba com o menu fechado (1196 ms)
5. ok: Painel, menu e sino medidos em 7:1 — Claro (787 ms): `02-menu-Claro.png`, `03-sino-Claro.png`
6. ok: Painel, menu e sino medidos em 7:1 — Escuro (705 ms): `04-menu-Escuro.png`, `05-sino-Escuro.png`
7. ok: Abrir e assumir em Maior, título e ações acessíveis (333 ms): `06-conversa-maior.png`
8. ok: Conversa, campos, status e encerramento com erros — Claro (791 ms): `07-encerramento-Claro.png`
9. ok: Conversa, campos, status e encerramento com erros — Escuro (768 ms): `08-encerramento-Escuro.png`
10. ok: 375px, Maior: conversa, sino e encerramento sem rolagem horizontal (528 ms): `09-celular-conversa.png`, `10-celular-sino.png`, `11-celular-encerramento.png`
11. ok: Número desconectado com palavra e contraste nos dois temas (1058 ms): `12-desconectado-Claro.png`, `13-conexao-Claro.png`, `14-desconectado-Escuro.png`, `15-conexao-Escuro.png`
12. ok: Sistema escuro e claro forçado preservam alto contraste (428 ms)
13. ok: Estado final no banco: chamado e mensagem preservados (130 ms)

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
  "measured": 74
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
    "id": 1,
    "status": "in_progress",
    "assignee_id": 2
  },
  {
    "id": 2,
    "status": "queued",
    "assignee_id": null
  }
]
```
