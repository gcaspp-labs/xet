# Jornada receive-and-assign: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:05.922Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (626 ms)
2. ok: Atendente entra e vê a fila vazia (142 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (204 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (149 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (241 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (300 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (210 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (302 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (193 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1104 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (643 ms)

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
  "protocol": "2026-000003",
  "status": "in_progress",
  "assignee": "Atendente1 005922154",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 005922154"
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
