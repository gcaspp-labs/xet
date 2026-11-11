# Consulta de CNPJ: comparação das APIs

Pesquisa que orientou a escolha da BrasilAPI no cadastro de órgãos (`docs/architecture.md`, Consulta de CNPJ).

Opções testadas em novembro de 2026, com CNPJ existente, inexistente e alfanumérico:

| | BrasilAPI | CNPJá (API pública) | ReceitaWS |
| --- | --- | --- | --- |
| Custo e chave | Gratuita, sem chave | Gratuita, sem chave | Rota testada sem chave |
| Limite | Nenhum publicado encontrado | 5 consultas por minuto por IP | Não confirmado |
| Código IBGE do município | Sim | Sim | Não |
| CNPJ alfanumérico de exemplo, não registrado | 404, com o formato reconhecido | 404 | HTTP 200 com `status: ERROR` |
