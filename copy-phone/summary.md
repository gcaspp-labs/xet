# Jornada copy-phone: PASSOU

Commit `c9e12feb1183bb72d05ff0d7e8f2feb2807d870b`, início 2026-11-19T01:09:30.859Z, duração 3 s.

### Passos

1. ok: Preparar setor com um atendente (435 ms)
2. ok: Chamado ativo: telefone no cabeçalho, copiar pelo botão (728 ms): `01-cabecalho-padrao.png`, `02-cabecalho-hover.png`, `03-cabecalho-copiado.png`
3. ok: Encerrar e abrir a ficha: botão ao lado do telefone na linha Contato (901 ms): `04-ficha-padrao.png`, `05-ficha-copiado.png`
4. ok: Estado final: o telefone do contato no banco bate com o copiado (129 ms)

### Estado final observado

Área de transferência (só números, 0 + DDD + número):

```json
{
  "copiado": "011570861504"
}
```

Contato:

```json
[
  {
    "id": 1,
    "phone": "5511570861504"
  }
]
```

Telefone no banco → copiado:

```json
{
  "banco": "5511570861504",
  "copiado": "011570861504"
}
```
