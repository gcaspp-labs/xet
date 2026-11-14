# PROTÓTIPO #177: ficha só leitura do atendimento encerrado (descartável, não vai para a main)

Uma versão (ajuste de tela existente) de `/atendimentos/:id`. API falsa em memória, só em
desenvolvimento, com dados fictícios (`fakeApi.ts`). Nada é gravado.

## Como rodar

```sh
git checkout prototype/177
cd frontend
BACKEND_URL=http://127.0.0.1:9 npx vite --port 5277
```

Ou `make dev-restart` na branch e a tela em `http://localhost:5173` (a API falsa responde no lugar do backend).

| Endereço | O que mostra |
|---|---|
| `/atendimentos/500` | encerrado, visto pelo administrador: com **Corrigir** |
| `/atendimentos/500?as=closer` | encerrado, visto por quem encerrou: com **Corrigir** |
| `/atendimentos/500?as=agent` | encerrado, visto por outro atendente: **sem** Corrigir |
| `/atendimentos/510` | transferido para outro setor, com origem (505) e destino |
| `/atendimentos/505` | o chamado anterior da cadeia (link "Ver chamado anterior") |
| `/atendimentos/520` | cancelado: nunca tem Corrigir |

Capturas: `node src/prototype/capture.mjs src/prototype/prototype-captures 177-depois` (com o vite em `:5277`).
