# Jornada dashboard-cancel: PASSOU

Commit `912daf8553b3a33c1472dba84b57850d8ae005ed`, início 2026-11-24T23:51:46.179Z, duração 2 s.

### Passos

1. ok: Preparar setor conectado e um chamado na fila (304 ms)
2. ok: O Dashboard mostra o chamado na lista Fila, com o X (269 ms): `01-dashboard-fila-com-x.png`
3. ok: O X pede confirmação no item e não abre o chamado (156 ms): `02-dashboard-confirmar.png`
4. ok: Esc volta sem cancelar, e a linha fora do X abre o chamado (152 ms)
5. ok: Cancelar chamado cancela sem janela e sem motivo, com o aviso (241 ms): `03-dashboard-cancelado.png`
6. ok: Estado final no banco: cancelado, sem motivo na auditoria (59 ms)

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
