# Jornada sector-transfer-without-form: PASSOU

Commit `e33fd59141d478512f00c8dade6e14926605a9d7`, início 2026-11-17T23:20:19.473Z, duração 120 s.

### Passos

1. ok: Preparar dois setores conectados e um contato não cadastrado na fila (474 ms)
2. ok: Atendente assume o chamado pela tela (127 ms)
3. ok: Responsável transfere sem formulário, com motivo, pela rota nova (sem tela até a #247) (67 ms)
4. ok: Origem aparece em Atendimentos como Transferido, sem assunto (3177 ms): `01-origem-no-historico.png`
5. ok: Ficha da origem abre só leitura, transferida para o destino (168 ms): `02-ficha-origem.png`
6. ok: Destino recebe o chamado na fila e abre a conversa (175 ms): `03-destino-na-fila.png`
7. ok: Estado final no banco e na auditoria (218 ms)

### Estado final observado

Origem:

```json
{
  "status": "closed",
  "closure_type": "transferred",
  "subject": null,
  "resolution": null,
  "organization_id": null,
  "transfer_reason": "Férias são com o outro setor.",
  "ended_at_transfer": true,
  "modules": 0
}
```

Destino:

```json
{
  "status": "queued",
  "previous_ticket_id": 1,
  "organization_id": null,
  "protocol": "2026-000002"
}
```

Auditoria da origem:

```json
{
  "action": "ticket_transferred_sector",
  "reason": "Férias são com o outro setor.",
  "closure": "transferred"
}
```
