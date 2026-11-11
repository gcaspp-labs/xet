# Jornada contacts-paging: PASSOU

Commit `55616c52a6b7691f838fa7d8466567eb2ae002d6`, início 2026-11-11T15:05:25.515Z, duração 3 s.

### Passos

1. ok: Preparar setor com 23 contatos em dois órgãos (pela API) (1020 ms)
2. ok: Atendente abre Contatos: página 1 de 2, por nome (299 ms): `01-pagina-1.png`
3. ok: Próxima: página 2 no endereço, com os 3 restantes (196 ms): `02-pagina-2.png`
4. ok: Contato decrescente volta à página 1 (166 ms): `03-contato-desc.png`
5. ok: Ordem por órgão: Autarquia antes da Câmara (163 ms): `04-orgao-asc.png`
6. ok: Ir a Órgãos e voltar mantém página e ordem (360 ms): `05-voltar.png`
7. ok: Página além da última mostra a última e corrige o endereço (305 ms): `06-pagina-excedente.png`
8. ok: Estado final pela API: total 23, página 2 com 3 itens (12 ms)

### Estado final observado

API: total 23, página 2, 3 itens:

```json

```
