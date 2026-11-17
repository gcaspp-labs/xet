# Jornada org-item-duas-linhas: PASSOU

Commit `ff8d5d0476100a27e717caaeb6a4427a4cb7f23c`, início 2026-11-17T01:24:29.579Z, duração 4 s.

### Passos

1. ok: Preparar setor e dois órgãos fictícios (um com CNPJ, um sem) (526 ms)
2. ok: Dashboard: lista do filtro estreito mostra nome inteiro e "Itu · CNPJ" (474 ms): `01-dashboard-duas-linhas.png`
3. ok: Selecionar o órgão: o campo mostra o nome e o filtro vai ao endereço (219 ms): `02-dashboard-selecionado.png`
4. ok: Contatos: o mesmo item no filtro de órgão (273 ms): `03-contatos-duas-linhas.png`
5. ok: Celular (375 px): a lista não passa da tela e o nome continua inteiro (377 ms): `04-celular-duas-linhas.png`
6. ok: Estado final no banco: os dois órgãos (128 ms)

### Estado final observado

Largura do campo / da lista (px):

```json
"260 / 512"
```

Lista no celular: x, largura (px):

```json
"6, 361"
```

Órgãos do marcador:

```json
[
  {
    "name": "Fundação Municipal de Amparo ao Desenvolvimento Científico, Cultural e Tecnológico Zeta669751",
    "tem_cnpj": true
  },
  {
    "name": "Sem CNPJ Zeta669751",
    "tem_cnpj": false
  }
]
```
