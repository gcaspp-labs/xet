# Evidência da #462 — favicon versionado

- **Antes:** o link do ícone era sempre `/favicon.svg`; o navegador que guardou o favicon antigo (polvo "GCASPP LAB") continuava mostrando o antigo na aba.
- **Depois:** `frontend/index.html` aponta para `/favicon.svg?v=2`, e o arquivo servido nesse endereço é o favicon do design system v2.0.0 (anel com três barras, `aria-label="GCASPP"`), igual byte a byte ao `assets/logos/favicon/favicon.svg` do pacote instalado.
- A imagem mostra o ícone antigo (do histórico do repositório, commit 62f85c5) e o novo servido em `http://localhost:18500/favicon.svg?v=2` (build de produção do PR), a 16, 32 e 180 px.
- Teste ponta a ponta: `npx playwright test e2e/auth.spec.ts` → 13 passed. Com o favicon antigo posto em `frontend/public/favicon.svg`, o teste novo falha em `Expected substring: "aria-label=\"GCASPP\""` / recebido `aria-label="GCASPP LAB"`.
