# Jornada react-api-198: PASSOU

Commit `a66c5cb44232f5d0f1f4179c0381249a27e87ded`, início 2026-11-16T10:22:12.545Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (446 ms)
2. ok: Atendente abre o chamado e assume (712 ms): `01-chamado-assumido.png`
3. ok: Responsável reage com 👍 pela sessão dele (282 ms)
4. ok: Outro emoji substitui e o mesmo emoji remove (286 ms)
5. ok: Texto livre é recusado (14 ms)
6. ok: Supervisor, sem ser o responsável, é recusado (194 ms)
7. ok: Recusa do WhatsApp: nada é gravado e a API avisa em português (213 ms): `02-conversa-depois-da-recusa.png`
8. ok: Estado final no banco (214 ms)

### Estado final observado

Reação do setor na API da conversa:

```json
{
  "emoji": "👍",
  "at": "2026-11-16T07:22:14.534568-03:00",
  "by": {
    "id": 3,
    "name": "Atendente1 532546807"
  },
  "viaPhone": false
}
```

Reações gravadas:

```json
[
  {
    "side": "sector",
    "emoji": "🙏",
    "author_id": 3,
    "via_phone": false
  }
]
```

Mensagens do chamado (a reação não vira mensagem):

```json
[
  {
    "direction": "inbound",
    "type": "text",
    "body": "Bom dia, preciso da guia"
  }
]
```
