# Jornada dashboard-cancel: PASSOU

Commit `c1625fbff876021bc22bb903c60586ceddea42a9`, início 2026-11-25T00:45:32.699Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado e um chamado na fila (276 ms)
2. ok: O Dashboard mostra o chamado na lista Fila, com o X (215 ms): `01-dashboard-fila-com-x.png`
3. ok: O X pede confirmação no item e não abre o chamado (142 ms): `02-dashboard-confirmar.png`
4. ok: Esc volta sem cancelar, e a linha fora do X abre o chamado (113 ms)
5. ok: Cancelar chamado cancela sem janela e sem motivo, com o aviso (212 ms): `03-dashboard-cancelado.png`
6. ok: Estado final no banco: cancelado, sem motivo na auditoria (60 ms)

### Estado final observado

Chamado cancelado pelo X do Dashboard:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": null
}
```
