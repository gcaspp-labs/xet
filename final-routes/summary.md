# Jornada final-routes: PASSOU

Commit `ac83a2eecf00a5c71a90a0eac516aa92c8af81b3`, início 2026-11-26T01:31:23.039Z, duração 4 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (828 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (821 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (379 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (510 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (270 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (108 ms)

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
