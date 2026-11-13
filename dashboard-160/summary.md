# Jornada dashboard-160: PASSOU

Commit `6af7012ea7cb6fc8ff245a1e5816056a46e445bb`, início 2026-11-13T17:52:54.209Z, duração 4 s.

### Passos

1. ok: Preparar setor e pessoas (459 ms)
2. ok: Preparar outro setor (438 ms)
3. ok: Preparar chamados fictícios (54 ms)
4. ok: Supervisor vê a fila do próprio setor (192 ms): `01-supervisor-fila.png`
5. ok: Assumir abre Conversas (248 ms): `02-conversa.png`
6. ok: Atendimento e nova fila aparecem ao vivo (302 ms): `03-supervisor-listas.png`
7. ok: Linha abre o chamado (187 ms): `04-chamado.png`
8. ok: Administrador vê os setores e filtra (540 ms): `05-admin-todos-setores.png`, `06-admin-setor.png`
9. ok: Estado final dos chamados (139 ms)

### Estado final observado

Chamados:

```json
[
  {
    "name": "João Fictício",
    "status": "queued"
  },
  {
    "name": "Maria Fictícia",
    "status": "in_progress"
  }
]
```
