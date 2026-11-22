# Jornada exclusao-ampliada-para-todos: PASSOU

Commit `e1c4ddba6af78fe693870ed536313172dbd76dcb`, início 2026-11-22T15:05:16.922Z, duração 4 s.

### Passos

1. ok: Preparar um atendimento com a mensagem do cliente e o responsável (732 ms)
2. ok: O responsável assume, envia a mensagem e a exclui para mim (878 ms): `01-excluida-para-mim-no-xet.png`
3. ok: O celular do setor exclui para todos: o aviso e a prévia continuam sem o conteúdo (347 ms): `02-chamados-mantem-o-aviso-do-xet.png`
4. ok: O chamado é encerrado (103 ms)
5. ok: Em Atendimentos, a janela de exclusão lista as duas, e a última vale "para todos" (590 ms): `03-atendimento-com-conteudo-preservado.png`, `04-janela-com-as-duas-exclusoes.png`
6. ok: Estado final no banco (231 ms)

### Estado final observado

Mensagem depois da ampliação:

```json
{
  "deletion_scope": "everyone",
  "deletion_origin": "agent"
}
```

Histórico de alterações:

```json
[
  {
    "kind": "deletion",
    "origin": "agent",
    "deletion_scope": "local",
    "com_horario": true
  },
  {
    "kind": "deletion",
    "origin": "phone",
    "deletion_scope": "everyone",
    "com_horario": true
  }
]
```
