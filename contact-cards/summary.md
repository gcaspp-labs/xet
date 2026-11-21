# Jornada contact-cards: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:08:57.631Z, duração 4 s.

### Passos

1. ok: Preparar setor conectado, atendente e os contatos cadastrados (762 ms)
2. ok: O cliente manda três contatos e a Fila mostra "👤 Nome" (232 ms): `01-fila-com-a-previa.png`
3. ok: Assumido, o chamado abre com os três cartões no mesmo balão (695 ms): `02-tres-cartoes-recebidos.png`
4. ok: Copiar o telefone de um cartão recebido, pelo teclado (162 ms): `03-telefone-copiado.png`
5. ok: Cartão enviado aparece com a situação de entrega (321 ms): `04-cartao-enviado-lida.png`
6. ok: Encerrado, o detalhe de Atendimentos mostra o cartão só para leitura (382 ms): `05-atendimentos-so-leitura.png`
7. ok: Estado final no banco (227 ms)

### Estado final observado

Mensagens de contato do chamado:

```json
[
  {
    "type": "contact",
    "status": null,
    "first_card": "Ana Beatriz Nunes",
    "cards": 3
  },
  {
    "type": "contact",
    "status": "read",
    "first_card": "Roberto Almeida",
    "cards": 1
  }
]
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved"
}
```
