# Jornada final-routes: PASSOU

Commit `941c159e02a9d7e7d48577ac72fee95b4df004f1`, início 2026-11-20T11:29:02.358Z, duração 6 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (1714 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (854 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (500 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (667 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (414 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (262 ms)

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
