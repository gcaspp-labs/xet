# Jornada final-routes: PASSOU

Commit `f116ad44d7e33c160235fd26d4369bb6558bc7db`, início 2026-11-25T06:00:30.341Z, duração 3 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (496 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (540 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (262 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (375 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (186 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (65 ms)

### Estado final observado

Chamados do setor (banco):

```json
[
  {
    "status": "closed",
    "closure_type": "resolved"
  },
  {
    "status": "queued",
    "closure_type": null
  }
]
```
