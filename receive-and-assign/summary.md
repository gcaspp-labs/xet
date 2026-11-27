# Jornada receive-and-assign: PASSOU

Commit `87098f246797e5ca98b43e6beae2a569f8c2e7f8`, início 2026-11-27T16:57:44.530Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (846 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (175 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (180 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (157 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (306 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (415 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (234 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (360 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (214 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (442 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1490 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (690 ms)

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
  "protocol": "2026-000002",
  "status": "in_progress",
  "assignee": "Atendente1 664530587",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 664530587"
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
