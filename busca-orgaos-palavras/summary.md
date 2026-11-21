# Jornada busca-orgaos-palavras: PASSOU

Commit `06ce5918f1daf593a044dbee9cba3954ae991510`, início 2026-11-21T00:53:47.878Z, duração 3 s.

### Passos

1. ok: Preparar órgãos com a mesma palavra em municípios diferentes (489 ms)
2. ok: Abrir a tela Órgãos (318 ms): `01-tela-orgaos.png`
3. ok: Buscar "câmara jales" encontra só a Câmara de Jales (180 ms): `02-busca-camara-jales.png`
4. ok: A ordem das palavras não importa: "jales câmara" (153 ms): `03-busca-jales-camara.png`
5. ok: Uma palavra sem acento continua encontrando: "camara" (149 ms): `04-busca-camara-sem-acento.png`
6. ok: Palavra que não aparece em nenhum campo zera o resultado (189 ms): `05-busca-sem-resultado.png`
7. ok: Nome com trecho de CNPJ: "prefeitura 11.222" (147 ms): `06-busca-prefeitura-cnpj.png`
8. ok: O seletor de órgão de Contatos também aceita as duas palavras (295 ms): `07-seletor-camara-jales.png`
9. ok: Estado final no banco (110 ms)

### Estado final observado

Órgãos cadastrados:

```json
[
  {
    "name": "Câmara Municipal",
    "municipality": "Jales",
    "cnpj": null
  },
  {
    "name": "Câmara dos Vereadores",
    "municipality": "Salto",
    "cnpj": null
  },
  {
    "name": "Prefeitura Municipal",
    "municipality": "Jales",
    "cnpj": "11222333000181"
  }
]
```
