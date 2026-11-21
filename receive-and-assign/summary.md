# Jornada receive-and-assign: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:09:04.863Z, duração 6 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (637 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (150 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (181 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (147 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (232 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (321 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (192 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (346 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (201 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (329 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1027 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (640 ms)

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
  "assignee": "Atendente1 744864834",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 744864834"
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
