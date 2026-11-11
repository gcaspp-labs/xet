# Testes ponta a ponta contra o build de produção

Os testes com Playwright rodam contra o build de produção do frontend (`vite build` e `vite preview`, com o mesmo proxy de `/api`), e não contra o servidor de desenvolvimento do Vite. O servidor de desenvolvimento compila cada módulo no primeiro acesso: com vários navegadores em paralelo e o cache vazio, como no CI, os primeiros carregamentos estouravam os tempos de espera, e os testes falhavam ao acaso.

## Consequências

- Cada execução do `make test-e2e` compila o frontend antes.
- Um erro que só aparece no modo de desenvolvimento não é pego pelos testes.
