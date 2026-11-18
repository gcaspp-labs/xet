# Jornada final-routes: PASSOU

Commit `7ba82c3bd1b60cb925b343ea2c209ed7bcce3a49`, início 2026-11-18T08:58:53.361Z, duração 2 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (459 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (516 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (191 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (433 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (204 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (61 ms)

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
