# Jornada chamado-pendente: PASSOU

Commit `c3f901a16d00d60071426b57631babe9242823d1`, início 2026-11-23T18:10:40.104Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado com dois atendentes (625 ms)
2. ok: Mensagem do cliente abre o chamado na fila do setor (151 ms)
3. ok: Atendente assume o chamado pela fila (252 ms)
4. ok: O ⋯ oferece Colocar como pendente, e o motivo é obrigatório (746 ms): `01-motivo-obrigatorio.png`, `02-janela-pendente.png`
5. ok: O chamado sai de Meus chamados e aparece na aba Pendentes (250 ms): `03-aba-pendentes.png`
6. ok: Outro atendente abre o pendente só leitura e vê a faixa (329 ms): `04-pendente-aberto.png`
7. ok: Ele retoma, e o chamado abre em Meus chamados dele (249 ms): `05-retomado.png`
8. ok: A aba de quem marcou perde o pendente sem recarregar (59 ms): `06-pendentes-vazia.png`
9. ok: Estado final no banco (233 ms)

### Estado final observado

Chamado retomado:

```json
{
  "status": "in_progress",
  "assignee": "Atendente2 440104477",
  "pending_reason": "Aguardando retorno do desenvolvimento sobre o erro no anexo",
  "has_pending_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 440104477"
  },
  {
    "action": "ticket_pending",
    "actor": "Atendente1 440104477"
  },
  {
    "action": "ticket_resumed",
    "actor": "Atendente2 440104477"
  }
]
```
