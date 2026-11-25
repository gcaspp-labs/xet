# Jornada busca-contato: PASSOU

Commit `9ffaa9dd39aa6a39f89acad51326f7143918674d`, início 2026-11-25T17:24:20.913Z, duração 4 s.

### Passos

1. ok: Preparar setor, órgão e contatos (685 ms)
2. ok: Novo chamado mostra a busca de contato (436 ms): `01-novo-chamado.png`
3. ok: Registrar atendimento por telefone mostra a busca de contato (465 ms): `02-registro-telefone.png`
4. ok: Enviar contato mostra a busca de contato (1093 ms): `03-enviar-contato.png`
5. ok: Estado final no banco (226 ms)

### Estado final observado

Enviar contato: posições das linhas (px):

```json
[
  {
    "linha": "Ana Contato",
    "topo": 412.22,
    "altura": 57.75,
    "espacoNomeTelefone": 2
  },
  {
    "linha": "Beto Contato",
    "topo": 470.97,
    "altura": 57.75,
    "espacoNomeTelefone": 2
  },
  {
    "linha": "Carla Contato",
    "topo": 529.72,
    "altura": 57.75,
    "espacoNomeTelefone": 2
  }
]
```

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
