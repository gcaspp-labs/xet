# Jornada retomar-pendente: PASSOU

Commit `aeda6b0eeeebbe8fd536eac7590e52d4d7c03e42`, início 2026-11-24T15:31:08.275Z, duração 2 s.

### Passos

1. ok: Preparar um setor conectado, a atendente e o cliente na primeira mensagem (251 ms)
2. ok: Atendente assume e coloca o chamado como pendente (555 ms): `01-colocar-como-pendente.png`
3. ok: O cliente volta a escrever e o chamado novo mostra o aviso na fila, sem a ação (249 ms): `02-aviso-na-fila.png`
4. ok: Atendente assume o chamado novo e o aviso ganha a ação (211 ms): `03-aviso-em-atendimento.png`
5. ok: A janela Retomar chamado lista o pendente do contato (233 ms): `04-janela-retomar-chamado.png`
6. ok: O chamado original abre com as mensagens dos dois e o aviso da retomada (163 ms): `05-chamado-original-retomado.png`
7. ok: Estado final no banco: o original em atendimento e o novo mesclado nele (164 ms)

### Estado final observado

Chamado original:

```json
[
  {
    "status": "in_progress",
    "assignee_id": 15,
    "pending_reason": "Aguardando a nota fiscal do serviço"
  }
]
```

Chamado novo mesclado:

```json
[
  {
    "status": "closed",
    "closure_type": "merged",
    "merged_into_ticket_id": 8
  }
]
```

Mensagens do original:

```json
[
  {
    "body": "Preciso da segunda via da guia",
    "ticket_id": 5
  },
  {
    "body": "Preciso da segunda via da guia",
    "ticket_id": 8
  },
  {
    "body": "Voltei com a nota fiscal",
    "ticket_id": 8
  }
]
```
