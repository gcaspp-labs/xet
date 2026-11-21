# Jornada dashboard-223-r2: PASSOU

Commit `5f064d9b11c35aab3418e3f55535442836ee6245`, início 2026-11-21T13:36:22.874Z, duração 5 s.

### Passos

1. ok: Preparar setor conectado, com dois atendentes (818 ms)
2. ok: Oito chamados chegam à fila pelos contatos (322 ms)
3. ok: Um chamado é iniciado pela pessoa, no sistema (522 ms)
4. ok: Um chamado é iniciado pelo celular do setor, fora do sistema (162 ms)
5. ok: A linha Sem atendente mostra o iniciado pelo celular, com dados reais (386 ms): `01-sem-atendente-com-dados-reais.png`
6. ok: A página 2 da Fila fica no endereço (270 ms): `02-fila-pagina-2.png`
7. ok: Recolher Agora e trocar o Canal limpa as páginas do endereço (592 ms): `03-agora-recolhida-filtro-trocado.png`
8. ok: Ao reabrir, as duas listas voltam à primeira página (290 ms): `04-fila-primeira-pagina.png`
9. ok: Estado final no banco (122 ms)

### Estado final observado

Chamados sem pessoa atribuída, com a origem da primeira mensagem:

```json
[
  {
    "id": 10,
    "created_by_id": null,
    "origin": "phone"
  }
]
```

Chamados do setor por autor:

```json
[
  {
    "total": 10,
    "com_pessoa": 1,
    "do_celular": 1
  }
]
```
