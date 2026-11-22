# Jornada rascunho-mensagem: PASSOU

Commit `df3fd73237f77b1b9e89f1dbf0dd16ebacdf8d84`, início 2026-11-22T10:29:39.878Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e dois chamados na fila (451 ms)
2. ok: Atendente assume o chamado da Ana e escreve (441 ms): `01-ana-texto-digitado.png`
3. ok: Recarregar devolve o texto, com o cursor no fim (273 ms): `02-ana-rascunho-depois-de-recarregar.png`
4. ok: Outro chamado começa vazio, e cada rascunho volta ao trocar pela lista (664 ms): `03-bia-texto-digitado.png`, `04-ana-rascunho-de-volta.png`, `05-bia-rascunho-de-volta.png`
5. ok: Enviar apaga o rascunho daquele chamado (450 ms): `06-bia-campo-vazio-depois-de-enviar.png`
6. ok: Apagar todo o texto também limpa o rascunho da Ana (395 ms): `07-ana-campo-vazio.png`
7. ok: Sair da conta apaga os rascunhos do usuário (428 ms): `08-rascunho-guardado-no-navegador.png`, `09-depois-de-sair-sem-rascunhos.png`
8. ok: Estado final: a mensagem da Bia foi aceita e nenhum rascunho sobrou (115 ms)

### Estado final observado

Mensagem enviada:

```json
[
  {
    "direction": "outbound",
    "status": "sent",
    "body": "*Atendente1 379878972:*\nRascunho da Bia"
  }
]
```
