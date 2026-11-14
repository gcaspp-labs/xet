# Jornada chamado-antigo: PASSOU

Commit `43f2e23408fca4da926ae63dd1847c051526776b`, início 2026-11-14T07:27:39.135Z, duração 3 s.

### Passos

1. ok: Preparar setor, atendente e contato cadastrado (525 ms)
2. ok: Atendente abre o chamado pelo "Novo chamado" (536 ms)
3. ok: Envelhecer o chamado: tudo dele passa a ter 60 dias (só datas, direto no banco) (438 ms)
4. ok: Reabrir o chamado antigo: registro com a frase nova e o nome de quem abriu (291 ms): `01-chamado-antigo-registro.png`
5. ok: Estado final: ticket_started preservado, sem texto no banco (111 ms)

### Estado final observado

Chamado com mais de 59 dias:

```json
{
  "antigo": true
}
```

Auditoria do chamado antigo:

```json
[
  {
    "action": "ticket_started",
    "antigo": true
  }
]
```
