# Jornada orgaos: PASSOU

Comparação com o protótipo aprovado: mesma disposição dos formulários nos três estados. Diferem os dados fictícios e a lista ao fundo; na consulta o CNPJ foi digitado sem máscara, e na edição o órgão já tinha CNPJ. O aviso de órgão salvo aparece ao fundo na edição.

Commit `39c2a7c494c7e173deb254be94078bd93a57a5b5`, início 2026-11-12T01:34:24.536Z, duração 3 s.

### Passos

1. ok: Preparar supervisor e consulta simulada (251 ms)
2. ok: Abrir cadastro com CNPJ primeiro (446 ms): `01-novo-orgao.png`
3. ok: Consultar e confirmar os dados sugeridos (648 ms): `02-consulta.png`
4. ok: Abrir edição com CNPJ primeiro (649 ms): `03-editar-orgao.png`
5. ok: Conferir órgão salvo (118 ms)

### Estado final observado

Órgão após edição:

```json
[
  {
    "name": "Prefeitura Exemplo",
    "cnpj": "11222333000181"
  }
]
```
