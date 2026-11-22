# Jornada ir-ao-fim: PASSOU

Commit `d43821249e7ae837046f921c33d5526a4097899d`, início 2026-11-22T17:38:14.991Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e uma conversa longa na fila (548 ms)
2. ok: Cliente manda 30 mensagens antes do atendente abrir (343 ms)
3. ok: Atendente assume: a conversa abre no fim, sem botão (709 ms): `01-no-fim-sem-botao.png`
4. ok: Rolada para cima, o botão aparece e a mensagem nova não desce a conversa (324 ms): `02-rolada-para-cima-com-1-nova.png`
5. ok: Mais uma nova conta 2, e o clique leva ao fim e zera (470 ms): `03-contador-em-2.png`, `04-depois-do-clique-no-fim.png`
6. ok: Enviar pelo compositor desce ao fim, mesmo rolado para cima (466 ms): `05-envio-do-compositor-no-fim.png`
7. ok: Estado final no banco (245 ms)

### Estado final observado

Mensagens do chamado:

```json
[
  {
    "total": 33
  }
]
```

Situação do chamado:

```json
[
  {
    "status": "in_progress"
  }
]
```
