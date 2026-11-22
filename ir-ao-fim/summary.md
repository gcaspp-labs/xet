# Jornada ir-ao-fim: PASSOU

Commit `287f8934ccc0207ddd9297747e53415790743001`, início 2026-11-22T18:03:02.229Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, atendente e uma conversa longa na fila (406 ms)
2. ok: Cliente manda 30 mensagens antes do atendente abrir (217 ms)
3. ok: Atendente assume: a conversa abre no fim, sem botão (537 ms): `01-no-fim-sem-botao.png`
4. ok: Rolada para cima, o botão aparece e a mensagem nova não desce a conversa (348 ms): `02-rolada-para-cima-com-1-nova.png`
5. ok: Mais uma nova conta 2, e a conversa continua onde estava (148 ms): `03-contador-em-2.png`
6. ok: O mesmo botão nos temas escuro e alto contraste (1440 ms): `04-contador-em-2-tema-escuro.png`, `05-contador-em-2-alto-contraste.png`
7. ok: O clique leva ao fim e zera o contador (243 ms): `06-depois-do-clique-no-fim.png`
8. ok: Enviar pelo compositor desce ao fim, mesmo rolado para cima (318 ms): `07-envio-do-compositor-no-fim.png`
9. ok: Estado final no banco (220 ms)

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
