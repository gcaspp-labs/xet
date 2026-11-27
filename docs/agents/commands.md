# Comandos

Os comandos do xet que as skills rodam, a partir da raiz do repositório. Este arquivo é a fonte para os agentes; o `Makefile` é a fonte para as pessoas. Mantenha os dois de acordo.

| Para | Comando |
|---|---|
| Subir o ambiente de desenvolvimento | `make dev` (banco em `:5440`, backend em `:8090`, frontend em `:5173`); roda `npm ci` no frontend sozinho quando o `package.json` ou o lockfile são mais novos que o `node_modules` |
| Reiniciar o ambiente na branch atual | `make dev-restart` (em segundo plano, log em `/tmp/xet-dev.log`; necessário a cada mudança no backend) |
| Testes | `make test` (integração do backend com `go test -race` e ponta a ponta com Playwright); separados: `make test-backend` e `make test-e2e` |
| Lint e formatação | `make lint` |
| Conferência do código gerado | `make check-generated` (sqlc, `go.mod` e a tabela de emojis das reações, que pede `npm ci` no frontend e o roda sozinho; depois de mudar `backend/db/queries`, rode `make sqlc` antes) |
| Protótipo de interface | `make dev-restart` na branch `prototype/*`, com a tela aberta em `http://localhost:5173`, depois do preparo isolado descrito abaixo |

## Protótipo de interface

Numa branch `prototype/*`, o protótipo só mostra o design system que o `frontend/package-lock.json` **daquele worktree** resolve. O `make dev-restart` continua sendo o comando que sobe a tela, mas ele reaproveita o `frontend/node_modules` que já estiver lá: o alvo `frontend-deps` só compara datas (`node_modules/.package-lock.json` mais novo que o `package.json` e o lockfile), e uma instalação copiada, linkada ou apontada de outro worktree passa nessa checagem sem ser o pacote certo. A versão declarada no `package.json` também não prova qual pacote está instalado. Por isso, prepare o ambiente antes de abrir a tela, na raiz do worktree atual:

1. Confirme que a instalação pertence a este worktree, e não a um link ou caminho de outro. O `readlink -f` devolve o próprio caminho mesmo quando o `node_modules` não existe, então a falta da pasta vem antes do `case`; um link quebrado não conta como falta (o `-e` falha nos dois casos), por isso o teste também exige que não seja link:

   ```bash
   root=$(git rev-parse --show-toplevel)
   if [ ! -e "$root/frontend/node_modules" ] && [ ! -L "$root/frontend/node_modules" ]; then
     echo "sem instalação: siga para o npm ci"
   else
     real=$(readlink -f "$root/frontend/node_modules")
     case "$real" in
       "$root/frontend/node_modules") echo "instalação local: siga para o npm ci" ;;
       *)
         echo "instalação fora do worktree ($real): pare e avise a pessoa; não apague nem mexa nela"
         false # sai com código diferente de 0, para não encadear com o npm ci
         ;;
     esac
   fi
   ```

   Um `npm link` feito só no pacote do design system (`node_modules/@gcaspp-labs/glab-design-system` apontando para outro lugar), com o resto do `node_modules` local, passa como "instalação local": o `npm ci` do passo 3 remove só o link, e é o passo 4 que mostra a diferença.

2. Leia no lockfile a URL resolvida e o commit efetivo do design system (o commit é o que vem depois do `#`):

   ```bash
   grep -A4 '"node_modules/@gcaspp-labs/glab-design-system"' frontend/package-lock.json
   ```

3. Com o passo 1 sem alerta, recrie a árvore instalada a partir do lockfile. O `npm ci` descarta o `node_modules` **deste** worktree:

   ```bash
   cd frontend && npm ci
   ```

4. Confira o que ficou instalado, ainda em `frontend/`:

   ```bash
   npm ls @gcaspp-labs/glab-design-system --depth=0
   node -p "require('./node_modules/@gcaspp-labs/glab-design-system/package.json').version"
   ```

   O `npm ls` imprime a versão e a URL resolvida com o commit (ex.: `@gcaspp-labs/glab-design-system@2.0.0 (git+ssh://git@github.com/gcaspp-labs/glab-design-system.git#a583ac3e…)`), e é ele que prova o commit instalado; o `package.json` de dentro do pacote traz só nome e versão. Se a URL, o commit ou a versão não forem os do passo 2, pare sem subir o protótipo e avise a pessoa.

5. Só então suba a tela, a partir da raiz do worktree: `make dev-restart`, em `http://localhost:5173`.

Nunca aponte, copie ou linke o `node_modules` de outro worktree para o atual: cada branch `prototype/*` usa a sua própria instalação, e a preparação nunca altera, apaga nem aponta para a instalação de outra branch.

## Branch principal

A branch em que os PRs entram e de onde as outras partem: a `develop`. A `main` é a produção e só recebe a `develop` por um PR aberto pela pessoa. As skills e o script da `merge-gate` leem este bloco; mantenha o nome do bloco.

```main-branch
develop
```

## Evidência

Como a `verify-app` prova que uma mudança funciona no app em execução.

- **Nível:** `journeys`
- **Start:** `scripts/verify/scripts/launch.sh` (instância isolada: banco em `127.0.0.1:25440`, API de CNPJ falsa em `:28091`, backend em `127.0.0.1:28090` com `MESSAGING_PROVIDER=fake`, frontend em `127.0.0.1:25173`). Saída 3: o Docker não responde; avise a pessoa e pare.
- **Check:** `scripts/verify/scripts/doctor.sh` (só lê; saída 1 quer dizer que não vale conduzir).
- **Run:** `scripts/verify/scripts/drive.sh <jornada...>` ou `drive.sh all`. As jornadas ficam em `scripts/verify/journeys/`; o objeto `t` delas está descrito em `scripts/verify/README.md`. Depois, `scripts/verify/scripts/evidence.sh` gera o resumo.
- **Clean up:** `scripts/verify/scripts/cleanup.sh` (encerra só o que a execução iniciou; nunca por nome de processo).
- **Pasta de evidência:** `.verify-app/runs/<execução>/evidence/`, ignorada pelo git.
- **Mapa de fluxos:** `scripts/verify/features/README.md`.
- **Dados de teste:** o `launch.sh` cria o próprio administrador, e as jornadas criam setores, pessoas e contatos pela API (`t.seedSector`, `t.customer`), com senhas que morrem com o banco da execução. Nunca use o WhatsApp real: o número é simulado pelo adaptador falso, e o que depende do real fica como verificação manual. Nunca leia `.dev-credentials`.

## Ao rodar

- Ao filtrar a saída (`| tail`, `| grep`), comece com `set -o pipefail`, para o filtro não esconder uma falha.
- Confira o resultado do lint e dos testes antes de commitar, enviar ou abrir o PR. Não encadeie tudo num comando só.
- **Docker via snap:** com `NoNewPrivs=1` no shell, o `Makefile` e os scripts da `verify-app` chamam o binário do snap pelo socket. Se o Docker ainda assim falhar, avise a pessoa e pare.
- **Memória:** a máquina tem 15 GB e o swap costuma estar cheio. Paradas de 5 a 6 s no `make test-e2e` ou nas jornadas costumam vir da memória, não do código: confira `free -m` antes de culpar a mudança.

## Concorrência

- **Portas fixas:** sim. Desenvolvimento: 5440, 8090, 5173. `make test`: 18080, 18081, 15173, 15432. `verify-app`: 25440, 28090, 28091, 25173. Outros projetos da máquina usam 5432, 5433, 8080 e 8081: não pare, remova nem altere os contêineres deles.
- **Tarefas em paralelo:** uma por vez.

## Teste manual

Para a pessoa testar um PR: `make dev-restart` na branch e a tela em `http://localhost:5173`, ou pelo celular via Tailscale em `http://<máquina>.<tailnet>.ts.net:5173`. As credenciais de desenvolvimento ficam em `.dev-credentials`, que só a pessoa lê. Testes com o WhatsApp real usam número de teste e ficam registrados em `docs/pilot-validation.md`.
