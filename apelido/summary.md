# Jornada apelido: PASSOU

Commit `800b799f91601ce41d93c97fe6ab1e851bd43449`, início 2026-11-13T12:03:06.900Z, duração 3 s.

### Passos

1. ok: Preparar setor e contato fictício (621 ms)
2. ok: Iniciar conversa com apelido em negrito e texto abaixo (636 ms): `01-primeira-mensagem.png`
3. ok: Enviar anexo com legenda e receber texto literal (371 ms): `02-legenda-e-resposta.png`
4. ok: Recarregar preserva o formato (315 ms): `03-apos-recarregar.png`
5. ok: Conferir estado gravado (133 ms)

### Estado final observado

Mensagens gravadas:

```json
[
  {
    "direction": "outbound",
    "body": "*Atendente1 386901718:*\nBom dia, primeira mensagem."
  },
  {
    "direction": "outbound",
    "body": "*Atendente1 386901718:*\nSegue o documento."
  },
  {
    "direction": "inbound",
    "body": "*Cliente:*\nRecebido, obrigado."
  }
]
```
