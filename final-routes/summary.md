# Jornada final-routes: PASSOU

Commit `74aaf29f8ff4f7067436848400a9b6096fddbd58`, início 2026-11-15T17:27:05.753Z, duração 4 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (881 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (731 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (302 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (598 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (274 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (110 ms)

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
