# Jornada final-routes: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:48.110Z, duração 4 s.

### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (812 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (728 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (307 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (628 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (301 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (120 ms)

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
