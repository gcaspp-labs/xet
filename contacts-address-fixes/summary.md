# Jornada contacts-address-fixes: PASSOU

Commit `015dc59c85aa9624ad64ca51306730ec442cae8a`, início 2026-11-11T15:32:50.391Z, duração 3 s.

### Passos

1. ok: Preparar setor com dois órgãos de Itu e um contato em cada (pela API) (528 ms)
2. ok: Reabrir endereço com órgão e busca sem resultado mostra o órgão no campo (290 ms): `01-orgao-lista-vazia.png`
3. ok: Reabrir com órgão e escolher o município dele mantém o órgão (545 ms): `02-municipio-mantem-orgao.png`
4. ok: Coluna desconhecida no endereço volta a nome crescente (246 ms): `03-coluna-desconhecida.png`
5. ok: Estado final pela API e no banco (134 ms)

### Estado final observado

Contatos do órgão no banco:

```json
[
  {
    "name": "Hugo S1"
  }
]
```
