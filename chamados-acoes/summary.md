# Jornada chamados-acoes: PASSOU

Commit `f316237e7a51070eb02145bb86ea96f338fc800a`, início 2026-11-14T23:47:32.425Z, duração 7 s.

### Passos

1. ok: Preparar setor com dois atendentes e um supervisor (678 ms)
2. ok: Meus chamados tem o "+" Novo chamado e o botão do topo saiu (538 ms): `01-meus-chamados-mais.png`, `02-janela-novo-chamado.png`
3. ok: Na fila: Assumir visível, Cancelar chamado só no ⋯ (758 ms): `03-fila-menu.png`
4. ok: Responsável: Encerrar visível; ⋯ com as ações e Cancelar chamado no fim (371 ms): `04-responsavel-cabecalho.png`, `05-responsavel-menu.png`
5. ok: Cancelar chamado abre a janela e volta a /chamados sem chamado aberto (511 ms): `06-cancelar-janela.png`
6. ok: Outro atendente assume o chamado do João (257 ms)
7. ok: Atendente em chamado de outra pessoa: sem ações e sem ⋯ (413 ms): `07-atendente-alheio-sem-acoes.png`
8. ok: Supervisor em chamado de outra pessoa: sem Encerrar nem Outro setor (1134 ms): `08-supervisor-alheio-menu.png`
9. ok: Administrador: cabeçalho com o seletor Setor em uma linha (880 ms): `09-administrador-cabecalho.png`
10. ok: Estado final no banco (132 ms)

### Estado final observado

Itens do ⋯ na fila:

```json
[
  "Cancelar chamado"
]
```

Altura do cabeçalho (atendente, desktop):

```json
{
  "px": 71.5
}
```

Itens do ⋯ do responsável:

```json
[
  "Devolver à fila",
  "Transferir",
  "Outro setor",
  "Cancelar chamado"
]
```

Itens do ⋯ do supervisor em chamado alheio:

```json
[
  "Devolver à fila",
  "Transferir",
  "Cancelar chamado"
]
```

Altura do cabeçalho (administrador, desktop):

```json
{
  "px": 84
}
```

Chamados do setor:

```json
[
  {
    "name": "Maria Cliente",
    "status": "closed"
  },
  {
    "name": "João Cliente",
    "status": "in_progress"
  }
]
```
