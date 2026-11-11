# Jornada contacts-paging: PASSOU

Commit `015dc59c85aa9624ad64ca51306730ec442cae8a`, início 2026-11-11T15:32:53.359Z, duração 3 s.

### Passos

1. ok: Preparar setor com 23 contatos em dois órgãos (pela API) (918 ms)
2. ok: Atendente abre Contatos: página 1 de 2, por nome (344 ms): `01-pagina-1.png`
3. ok: Próxima: página 2 no endereço, com os 3 restantes (203 ms): `02-pagina-2.png`
4. ok: Contato decrescente volta à página 1 (157 ms): `03-contato-desc.png`
5. ok: Ordem por órgão: Autarquia antes da Câmara (208 ms): `04-orgao-asc.png`
6. ok: Ir a Órgãos e voltar mantém página e ordem (356 ms): `05-voltar.png`
7. ok: Página além da última mostra a última e corrige o endereço (293 ms): `06-pagina-excedente.png`
8. ok: Estado final pela API: total 23, página 2 com 3 itens (18 ms)

### Estado final observado

API: total 23, página 2, 3 itens:

```json

```
