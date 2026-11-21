# Jornada dashboard-223: PASSOU

Commit `9aa69ae6801853bd262c5f2ce1096c2e665afcc2`, início 2026-11-21T11:39:33.815Z, duração 8 s.

### Passos

1. ok: Preparar setor conectado, com dois atendentes (858 ms)
2. ok: Doze chamados chegam à fila (503 ms)
3. ok: Seis chamados são assumidos por um atendente (494 ms)
4. ok: Cada lista mostra a quantidade entre parênteses no título, sem cartões (2632 ms): `01-titulos-com-quantidade.png`
5. ok: A Fila pagina de 5 em 5, os mais recentes primeiro (328 ms): `02-fila-pagina-1.png`
6. ok: A segunda página mantém a altura da tabela (292 ms): `03-fila-pagina-2.png`
7. ok: Em atendimento pagina sozinha e também mantém a altura (316 ms): `04-em-atendimento-pagina-2.png`
8. ok: A tabela tem Total e a linha Do setor com os números da pessoa (213 ms): `05-total-e-do-setor.png`
9. ok: Assumir é o botão de destaque (primary) (267 ms): `06-assumir-primary.png`
10. ok: Recolher funciona nas duas seções e a escolha sobrevive ao recarregar (915 ms): `07-periodo-recolhido.png`, `08-recolhido-apos-recarregar.png`, `09-periodo-aberto.png`
11. ok: Estado final no banco (128 ms)

### Estado final observado

Chamados do setor por situação:

```json
[
  {
    "status": "queued",
    "n": 6
  },
  {
    "status": "in_progress",
    "n": 6
  }
]
```
