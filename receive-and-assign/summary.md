# Jornada receive-and-assign: PASSOU

Commit `143e165648781335e66799e8cabbe825b85ddb61`, início 2026-11-04T20:51:41.853Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (839 ms)
2. ok: Atendente entra e vê a fila vazia (250 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (250 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (165 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (313 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (319 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (257 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (355 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (236 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1490 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (735 ms)

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
  "protocol": "2026-000011",
  "status": "in_progress",
  "assignee": "Atendente1 501853522",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 501853522"
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
