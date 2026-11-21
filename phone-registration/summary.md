# Jornada phone-registration: PASSOU

Commit `9471fd3bc165f67b390a6802ed23510610ed6f79`, início 2026-11-21T02:00:25.637Z, duração 3 s.

### Passos

1. ok: Preparar setor, contato com chamado aberto no WhatsApp e registro por telefone pela API (897 ms)
2. ok: Atendimentos lista o registro por telefone como encerrado (310 ms): `01-lista-com-registro.png`
3. ok: A ficha do registro abre só leitura, sem mensagens (218 ms): `02-ficha-do-registro.png`
4. ok: O chamado do WhatsApp continua em Chamados com a atendente (142 ms): `03-chamado-aberto-intacto.png`
5. ok: Estado final no banco (461 ms)

### Estado final observado

Chamados da Rita:

```json
[
  {
    "id": 1,
    "protocol": "2026-000001",
    "status": "in_progress",
    "channel": "whatsapp",
    "closure_type": null,
    "same_person": null,
    "times_from_start": false,
    "not_started": true
  },
  {
    "id": 2,
    "protocol": "2026-000002",
    "status": "closed",
    "channel": "phone",
    "closure_type": "resolved",
    "same_person": true,
    "times_from_start": true,
    "not_started": true
  }
]
```

Auditoria do registro:

```json
[
  {
    "action": "ticket_phone_registered",
    "actor_id": 3
  }
]
```

Mensagens do registro:

```json
[
  {
    "count": 0
  }
]
```

Chamado aberto:

```json
[
  {
    "status": "in_progress",
    "channel": "whatsapp"
  }
]
```
