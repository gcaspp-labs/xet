# Jornada receive-and-assign: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:23:55.604Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (861 ms)
2. ok: Atendente entra e vê a fila vazia (144 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (240 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (143 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (265 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (335 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (216 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (351 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (232 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1413 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (717 ms)

### Estado final observado

Disputa simultânea: respostas HTTP e auditoria:

```json
{
  "respostas": [
    200,
    409
  ],
  "registrosDeAuditoria": 1
}
```

Outro setor pedindo o chamado pela API:

```json
{
  "http": 403
}
```

Chamado:

```json
{
  "protocol": "2026-000004",
  "status": "in_progress",
  "assignee": "Atendente1 235604534",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 235604534"
  }
]
```

Mensagens e chamados abertos do contato:

```json
{
  "mensagens": 2,
  "chamadosAbertos": 1
}
```
