# Jornada transfer-reason: PASSOU

Commit `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1`, início 2026-11-18T01:51:27.874Z, duração 3 s.

### Passos

1. ok: Preparar dois setores conectados e dois contatos fictícios na origem (520 ms)
2. ok: Responsável transfere os dois chamados pela rota nova, um com motivo e outro sem (88 ms)
3. ok: Origem: aviso da conversa mostra quem transferiu, o setor e o motivo (381 ms): `01-origem-com-motivo.png`, `02-origem-sem-motivo.png`
4. ok: Destino: aviso na conversa do chamado da fila mostra a origem e o motivo (381 ms): `03-destino-com-motivo.png`, `04-destino-sem-motivo.png`
5. ok: Destino encerra os dois; o quadro de origem mostra setor, protocolo, quem transferiu e o motivo, sem assunto nem resolução (493 ms): `05-quadro-com-motivo.png`, `06-quadro-sem-motivo.png`
6. ok: Estado final no banco (107 ms)

### Estado final observado

Motivos guardados nas origens:

```json
[
  {
    "id": 1,
    "status": "closed",
    "closure_type": "transferred",
    "subject": null,
    "resolution": null,
    "transfer_reason": "Quem cuida de férias é o RH."
  },
  {
    "id": 2,
    "status": "closed",
    "closure_type": "transferred",
    "subject": null,
    "resolution": null,
    "transfer_reason": null
  }
]
```
