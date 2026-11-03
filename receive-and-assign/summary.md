# Jornada receive-and-assign: PASSOU

Commit `5549f925a0ce3210cbea567f99298f6984756ef8`, início 2026-11-03T14:21:30.361Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (865 ms)
2. ok: Atendente entra e vê a fila vazia (142 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (151 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (247 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (343 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (258 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (156 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (532 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (157 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1195 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (1125 ms)

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
  "assignee": "Atendente1 690362643",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 690362643"
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
