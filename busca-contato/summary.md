# Jornada busca-contato: PASSOU

Commit `74e591e9dd1ef033c6c6a454e981cfedccaf1eba`, início 2026-11-25T17:00:25.100Z, duração 3 s.

### Passos

1. ok: Preparar setor, órgão e contatos (643 ms)
2. ok: Novo chamado mostra a busca de contato (392 ms): `01-novo-chamado.png`
3. ok: Registrar atendimento por telefone mostra a busca de contato (410 ms): `02-registro-telefone.png`
4. ok: Enviar contato mostra a busca de contato (853 ms): `03-enviar-contato.png`
5. ok: Estado final no banco (176 ms)

### Estado final observado

Contatos do órgão:

```json
[
  {
    "name": "Ana Contato"
  },
  {
    "name": "Beto Contato"
  },
  {
    "name": "Carla Contato"
  }
]
```

Chamados do setor:

```json
[
  {
    "status": "in_progress",
    "count": 1
  }
]
```
