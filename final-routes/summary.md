# Jornada final-routes: PASSOU

Commit `cb364df16b7be5e35ce6c2195194f88cb17430d5`, início 2026-11-25T07:02:50.525Z, duração 3 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (496 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (542 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (284 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (337 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (214 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (58 ms)

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
