# Jornada fila-admin-setores-ativos: PASSOU

Commit `995ce9e40e053e0a14ad233708ebe0fa446cd3c8`, início 2026-11-13T22:57:55.361Z, duração 4 s.

### Passos

1. ok: Preparar setor ativo e setor que será desativado (456 ms)
2. ok: Setor 2 (408 ms)
3. ok: Atendente do setor assume o chamado próprio antes da desativação (299 ms)
4. ok: Chegam chamados nos dois setores e o setor 2 é desativado (319 ms)
5. ok: Administrador: lista e contador só com o setor ativo (273 ms): `01-admin-fila-so-ativos.png`
6. ok: Chamado novo no setor inativo não entra; no ativo entra, em tempo real (163 ms): `02-admin-fila-tempo-real.png`
7. ok: Contador sobre a aba Fila com a aba Assuntos aberta (341 ms): `03-admin-contador-aba-assuntos.png`
8. ok: Contador some quando a fila visível esvazia (513 ms): `04-admin-fila-vazia-com-setor-inativo-pendente.png`
9. ok: Atendente do setor inativo mantém fila e Meus atendimentos (167 ms): `05-atendente-setor-inativo.png`
10. ok: Estado final no banco (122 ms)

### Estado final observado

Setor desativado:

```json
[
  {
    "id": 1,
    "active": true
  },
  {
    "id": 2,
    "active": false
  }
]
```

Chamados por situação:

```json
[
  {
    "active": false,
    "status": "queued",
    "n": 2
  },
  {
    "active": false,
    "status": "in_progress",
    "n": 1
  },
  {
    "active": true,
    "status": "in_progress",
    "n": 3
  }
]
```
