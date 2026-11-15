# Jornada receive-and-assign: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:52.078Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (574 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (117 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (187 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (136 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (227 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (282 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (146 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (306 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (196 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (274 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (975 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (582 ms)

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
  "protocol": "2026-000015",
  "status": "in_progress",
  "assignee": "Atendente1 632079698",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 632079698"
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
