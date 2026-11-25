# Jornada mesclar-em-pendente: PASSOU

Commit `80337a84009b45c8d6025e059699650d57f9324a`, início 2026-11-25T03:57:23.595Z, duração 3 s.

### Passos

1. ok: Preparar um encerrado e um cancelado, cada um com um pendente do contato (650 ms)
2. ok: Na ficha do encerrado, Mesclar em pendente fica ao lado do Corrigir (234 ms): `01-ficha-com-as-duas-acoes.png`
3. ok: A janela lista o pendente do contato, sem campo de motivo (150 ms): `02-janela-do-pendente.png`
4. ok: Confirmar mescla: o pendente abre como Encerrado, com as mensagens dos dois e o aviso (300 ms): `03-pendente-mesclado-aberto.png`
5. ok: O encerrado mesclado aparece em Atendimentos como Mesclado (245 ms): `04-lista-com-o-mesclado.png`
6. ok: O cancelado não tem Corrigir, mescla, e o aviso traz o motivo do cancelamento (379 ms): `05-aviso-do-cancelado-com-motivo.png`
7. ok: Estado final no banco (113 ms)

### Estado final observado

Atendimentos e pendentes (banco):

```json
"[{\"id\":1,\"status\":\"closed\",\"closure_type\":\"resolved\",\"subject\":\"Segunda via\",\"merged_into_ticket_id\":null,\"ended\":true},{\"id\":2,\"status\":\"closed\",\"closure_type\":\"merged\",\"subject\":null,\"merged_into_ticket_id\":1,\"ended\":true},{\"id\":3,\"status\":\"closed\",\"closure_type\":\"cancelled\",\"subject\":null,\"merged_into_ticket_id\":null,\"ended\":true},{\"id\":4,\"status\":\"closed\",\"closure_type\":\"merged\",\"subject\":null,\"merged_into_ticket_id\":3,\"ended\":true}]"
```

Registros da mesclagem na auditoria:

```json
"[{\"ticket_id\":1,\"action\":\"ticket_closed_by_merge\",\"reason\":null,\"merged_protocol\":\"2026-000002\"},{\"ticket_id\":3,\"action\":\"ticket_closed_by_merge\",\"reason\":\"Cliente desistiu do comprovante\",\"merged_protocol\":\"2026-000004\"}]"
```
