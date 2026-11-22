# Jornada esc-volta-chamados: PASSOU

Commit `8d1ce76981c9d1f68936ad6fd66eb8d11ef1b960`, início 2026-11-22T17:39:47.543Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e um chamado na fila (595 ms)
2. ok: Atendente assume o chamado e a conversa abre (605 ms)
3. ok: Com texto no campo, o Esc volta para Chamados sem chamado aberto (170 ms): `01-esc-volta-para-chamados.png`
4. ok: Ao reabrir o chamado, o texto digitado está no campo (304 ms): `02-texto-guardado-no-rascunho.png`
5. ok: Com o seletor de emojis aberto, o Esc fecha só o seletor (675 ms): `03-esc-fecha-so-o-seletor.png`
6. ok: Com a janela de encerrar (bloqueio) aberta, o Esc não fecha nem volta (701 ms): `04-esc-nao-fecha-janela-com-bloqueio.png`, `05-chamado-continua-aberto.png`
7. ok: Estado final no banco (242 ms)

### Estado final observado

Situação do chamado:

```json
[
  {
    "status": "in_progress"
  }
]
```

Mensagens do chamado:

```json
[
  {
    "total": 1
  }
]
```
