# Jornada reactions: PASSOU

Commit `05e807a5c668c96a251a88b47986c2c570f15956`, início 2026-11-16T15:22:05.060Z, duração 5 s.

### Passos

1. ok: Preparar setor, atendente, supervisor e chamado com mensagem (431 ms)
2. ok: Atendente assume o chamado (434 ms)
3. ok: Reação do cliente aparece embaixo, sem recarregar (202 ms): `01-reacao-do-cliente.png`
4. ok: Responsável abre a barra e reage com 🙏 (499 ms): `02-barra.png`, `03-reacao-do-setor.png`
5. ok: Troca pelo "+" e remove tocando de novo (1046 ms): `04-mais-emojis.png`, `05-removida.png`
6. ok: Supervisor vê as reações e não reage (638 ms): `06-supervisor-so-leitura.png`
7. ok: Estado final no banco (107 ms)

### Estado final observado

Reações da mensagem:

```json
[
  {
    "side": "customer",
    "emoji": "👍"
  },
  {
    "side": "sector",
    "emoji": "🙏"
  }
]
```
