# Jornada organizations-paging: PASSOU

Commit `f3286563628bb7afb2a994df5a905d83ac57007b`, início 2026-11-11T20:59:21.354Z, duração 3 s.

### Passos

1. ok: Preparar setor e 23 órgãos com o mesmo marcador (651 ms)
2. ok: Buscar abre a página 1 por nome, com 20 órgãos e o total (343 ms): `01-pagina-1-por-nome.png`
3. ok: Próxima mostra os 3 restantes e guarda a página no endereço (206 ms): `02-pagina-2.png`
4. ok: Município ordena crescente e volta à página 1 (171 ms): `03-ordem-por-municipio.png`
5. ok: Clicar de novo inverte a direção (185 ms): `04-municipio-decrescente.png`
6. ok: Página além da última no endereço mostra a última (238 ms): `05-pagina-excedente-vira-ultima.png`
7. ok: Sair para Contatos e voltar conserva busca, página e ordem (246 ms): `06-voltar-conserva-estado.png`
8. ok: O seletor de órgão em Contatos avisa que há mais e o refino acha o 23º (389 ms): `07-seletor-avisa-mais.png`, `08-seletor-refinado.png`
9. ok: Estado final no banco (123 ms)

### Estado final observado

Órgãos do marcador por município:

```json
[
  {
    "municipio": "Itu",
    "count": 22
  },
  {
    "municipio": "Águas de Lindóia",
    "count": 1
  }
]
```
