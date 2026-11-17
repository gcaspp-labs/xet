# Jornada org-picker-scroll: PASSOU

Commit `c6fac6b4cfab13b80810e915dde43dd54405ddfc`, início 2026-11-17T00:13:50.865Z, duração 3 s.

### Passos

1. ok: Preparar setor e 23 órgãos fictícios com o mesmo marcador (692 ms)
2. ok: Abrir Contatos e buscar pelo marcador: 20 opções e "Mostrando 20 de 23 órgãos" (366 ms): `01-busca-20-de-23.png`
3. ok: Rolar até o fim: 23 opções, o texto some e o 23º aparece (244 ms): `02-rolou-23.png`
4. ok: Digitar de novo volta à página 1 e ao topo (199 ms): `03-recomecou-pagina-1.png`
5. ok: Só com o teclado: setas até o fim carregam a próxima página (658 ms): `04-teclado-23.png`
6. ok: Estado final no banco: 23 órgãos do marcador (99 ms)

### Estado final observado

Órgãos do marcador:

```json
[
  {
    "count": 23
  }
]
```
