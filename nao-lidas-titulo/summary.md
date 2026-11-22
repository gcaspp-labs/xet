# Jornada nao-lidas-titulo: PASSOU

Commit `d5da8c9ec8108d89c468828e500dc17b317d324c`, início 2026-11-22T22:48:36.984Z, duração 3 s.

### Passos

1. ok: Preparar setor conectado com um atendente (568 ms)
2. ok: Fila e chamado meu somam no título da aba (295 ms): `01-fila-dois-chamados.png`
3. ok: Assumir um chamado baixa a fila do título (298 ms)
4. ok: Mensagem nova soma no título e aparece em Meus chamados (271 ms): `02-nao-lidas-no-titulo.png`
5. ok: Abrir o chamado marca como lido e baixa o título (257 ms): `03-chamado-aberto.png`
6. ok: Estado final no banco (113 ms)

### Estado final observado

Título com dois chamados na fila:

```json
{
  "titulo": "(2) Central de Atendimento"
}
```

Título com o chamado assumido e a fila de 1:

```json
{
  "titulo": "(1) Central de Atendimento"
}
```

Título com fila (1) e não lidas (1):

```json
{
  "titulo": "(2) Central de Atendimento"
}
```

Título depois da leitura:

```json
{
  "titulo": "(1) Central de Atendimento"
}
```

Chamado depois da leitura:

```json
{
  "status": "in_progress",
  "assignee": "Atendente1 716985417",
  "lido": true
}
```
