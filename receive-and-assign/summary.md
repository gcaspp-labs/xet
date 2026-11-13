# Jornada receive-and-assign: PASSOU

Commit `6af7012ea7cb6fc8ff245a1e5816056a46e445bb`, início 2026-11-13T17:53:18.625Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (623 ms)
2. ok: Atendente entra e vê a fila vazia (109 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (181 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (145 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (222 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (320 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (147 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (294 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (178 ms): `06-painel-em-atendimento.png`
10. ok: Atendente assume outro chamado pelo painel (304 ms): `07-assumido-pelo-painel.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1191 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (632 ms)

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
  "assignee": "Atendente1 398626778",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 398626778"
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
