# Comandos

Os comandos do xet que as skills rodam, a partir da raiz do repositório. Este arquivo é a fonte para os agentes; o `Makefile` é a fonte para as pessoas. Mantenha os dois de acordo.

| Para | Comando |
|---|---|
| Subir o ambiente de desenvolvimento | `make dev` (banco em `:5440`, backend em `:8090`, frontend em `:5173`) |
| Reiniciar o ambiente na branch atual | `make dev-restart` (em segundo plano, log em `/tmp/xet-dev.log`; necessário a cada mudança no backend) |
| Testes | `make test` (integração do backend com `go test -race` e ponta a ponta com Playwright); separados: `make test-backend` e `make test-e2e` |
| Lint e formatação | `make lint` |
| Conferência do código gerado | `make check-generated` (depois de mudar `backend/db/queries`, rode `make sqlc` antes) |
| Protótipo de interface | `make dev-restart` na branch `prototype/*`, com a tela aberta em `http://localhost:5173` |

## Branch principal

A branch em que os PRs entram e de onde as outras partem. As skills e o script da `merge-gate` leem este bloco; mantenha o nome do bloco.

```main-branch
main
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
