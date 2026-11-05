# Jornada receive-and-assign: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:08.965Z, duração 7 s.

### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (799 ms)
2. ok: Atendente entra e vê a fila vazia (119 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (214 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (160 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (264 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (354 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (210 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (343 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (227 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1376 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (658 ms)

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
  "protocol": "2026-000008",
  "status": "in_progress",
  "assignee": "Atendente1 368965740",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 368965740"
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
