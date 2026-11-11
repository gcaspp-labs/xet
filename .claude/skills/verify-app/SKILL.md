---
name: verify-app
description: Prova com evidências que uma mudança funciona no xet, a central de atendimento via WhatsApp (Go, React e PostgreSQL), sem usar o WhatsApp real. Sobe uma instância isolada, conduz o navegador como um usuário, guarda capturas de tela e o estado final do banco, e deixa a máquina como estava. Use quando pedirem para verificar, conferir ou provar uma mudança ou um PR no app em execução, além dos testes automatizados.
---

# Verificar o xet em execução

O xet é uma central de atendimento: cada setor tem um número de WhatsApp, as mensagens viram **chamados**, os **atendentes** assumem e respondem, os **supervisores** acompanham o setor, e o chamado termina com um formulário de encerramento. As regras estão em `docs/features/`; o mapa do que dá para percorrer está em [features/README.md](features/README.md).

Esta skill não substitui `make test`. Os testes dizem que as regras continuam valendo; a verificação mostra a mudança funcionando como o usuário a vê, com evidência que outra pessoa pode conferir.

## Regras

- Nunca use o WhatsApp real. O número e o contato são simulados pelo adaptador falso; o que depende do real fica marcado como verificação manual, e não como provado.
- Prove pelo caminho do usuário: entre pela tela de login, clique no que ele clica e confira o que ele vê. Dados de preparação podem vir pela API, mas o que está sendo provado, não.
- Se os dados não atenderem a uma pré-condição, a jornada falha, e o motivo vai para os Gotchas do fluxo. Nunca enfraqueça uma jornada para ela passar.
- Não leia `.dev-credentials` nem mostre senhas na saída. A execução cria os próprios usuários, com senhas que morrem com o banco dela.
- Não mexa no ambiente do `make dev` (5440, 8090 e 5173), nas portas do `make test` (18080, 18081, 15173 e 15432) nem em outros projetos da máquina (5432, 5433, 8080 e 8081, com os contêineres deles).
- Se a verificação precisar de uma rota ou mudança no produto, pare e pergunte. Esta skill não altera código do produto.
- Rode sempre em ordem: Launch, Doctor, Drive, Evidence e Cleanup. Depois de qualquer tentativa que falhar, rode o Cleanup.

Todos os comandos abaixo saem da raiz do repositório.

## Launch

```bash
.claude/skills/verify-app/scripts/launch.sh
```

Parte do zero e leva menos de 1 minuto, ou mais se precisar baixar dependências. Pronto quando imprimir `Execução run-... no ar` e terminar com saída 0.

| Peça | Como sobe | Porta |
| --- | --- | --- |
| Banco PostgreSQL | Contêiner `xet-verify-db-<execução>`, vazio, descartado no Cleanup | `127.0.0.1:25440` |
| API de CNPJ falsa | `frontend/e2e/fake-cnpj-api.mjs`, para nunca chamar o serviço real | `:28091` |
| Backend | Binário próprio com `MESSAGING_PROVIDER=fake`, que monta `/api/test/messaging` | `127.0.0.1:28090` |
| Frontend | Build de produção com `vite preview`, com proxy de `/api` para o backend | `127.0.0.1:25173` |

- Também cria o administrador da execução pelo `create-admin`, como na implantação, e instala `frontend/node_modules` e o Chromium do Playwright, se faltarem.
- Tudo fica em `.verify-app/runs/<execução>/`, ignorado pelo git: `evidence/`, `logs/`, `state/` e `build/`.
- **Uma execução por vez na máquina.** As portas são fixas de propósito, porque não há memória para duas instâncias. Se uma estiver ocupada, o Launch para sem encerrar nada: espere a outra verificação terminar.
- **Docker via snap:** com `NoNewPrivs=1` no shell, o `common.sh` chama o binário do snap direto, pelo socket, como o `Makefile`. Esse caminho dá acesso ao Docker inteiro da máquina, por isso use-o só para esta verificação e só com o contêiner da própria execução. Não pare, remova nem altere contêineres de outros projetos.
- **Saída 3: o Docker não responde mesmo assim.** Avise o usuário e pare.
- Em qualquer outra falha, o Launch desfaz o que iniciou e aponta os logs.

## Doctor

```bash
.claude/skills/verify-app/scripts/doctor.sh
```

Só lê. Confere banco, migrações, administrador, backend, adaptador falso em uso, proxy, Chromium e memória. Saída 0 quer dizer que vale a pena conduzir; saída 1 quer dizer que não. Nesse caso, corrija a causa ou recomece, sem conduzir.

Leve a sério os avisos:

- **Commit diferente:** a instância foi construída em outro commit. Recomece, ou a evidência não prova a mudança atual.
- **Arquivos sem commit:** a evidência não corresponde só ao commit. Diga isso no resultado.
- **Memória baixa:** espere lentidão.

## Drive

```bash
.claude/skills/verify-app/scripts/drive.sh receive-and-assign reply
```

```bash
.claude/skills/verify-app/scripts/drive.sh all
```

Conduz uma jornada de cada vez, com um Chromium só e sem workers em paralelo, porque a máquina tem 15 GB e o swap costuma estar cheio. Cada jornada é um script Node em `journeys/`. Sessões de pessoas diferentes são contextos do mesmo navegador. Saída 1 quer dizer que alguma falhou.

**Qual jornada rodar:** leia o diff, ache em [features/README.md](features/README.md) os fluxos que ele toca e rode esses. Sem ligação clara, ou mudança ampla, rode `all`.

**Mudança que nenhuma jornada cobre:** escreva uma jornada para ela. Se o fluxo for durável, crie `journeys/<nome>.mjs` e `features/<nome>.md`. Se for só para este PR, crie o arquivo em `.verify-app/runs/<execução>/` e passe o caminho ao `drive.sh`:

```js
const { expect, journey } = await import(process.env.VERIFY_APP_LIB)

await journey('nome-da-jornada', async (t) => {
  const sector = await t.step('Preparar setor com um atendente', () => t.seedSector({ agents: 1 }))
  const phone = t.phone(sector.id)
  const page = await t.signIn(sector.agents[0])
  await t.step('Mensagem chega à fila sem recarregar', async () => {
    await phone.receive(t.customer('Maria Cliente'), 'Bom dia')
    await expect(page.getByRole('region', { name: 'Fila do setor' })).toContainText('Bom dia')
    await t.shot(page, 'mensagem-na-fila')
  })
  await t.step('Estado final no banco', async () => {
    t.observe('Chamados do setor', t.sql(`select status from tickets where sector_id = ${sector.id}`))
  })
})
```

| Do objeto `t` | O que faz |
| --- | --- |
| `t.step(título, função)` | Um passo da jornada; a primeira falha encerra a jornada |
| `t.signIn(usuário, opções)` | Entra pela tela de login em sessão própria e devolve a página. `blockRealtime: true` deixa a tela desatualizada, e `viewport` muda o tamanho |
| `t.closeSession(página)` | Fecha a sessão, para liberar memória |
| `t.seedSector({ agents, connected, modules })` | Cria setor, supervisor e atendentes pela API. Devolve `{ id, name, supervisor, agents }`; cada pessoa tem `id`, `name` e `email` |
| `t.seedOrganization(município)` | Cria um órgão e devolve `{ name, municipality }` |
| `t.customer(nome)` | Um contato com telefone único |
| `t.phone(setor)` | O celular simulado: `receive(contato, texto, id?)`, `pair(conta?)`, `nextQR()`, `drop()`, `logOut()`, `unreachable()`, `status(situação, ids)` |
| `t.sql(consulta)` | Lê o banco em transação só de leitura e devolve as linhas |
| `t.shot(página, nome)` | Captura de tela numerada, ligada ao passo |
| `t.observe(título, valor)` | Registra um estado final no resumo |
| `t.admin` | Sessão de API do administrador, para preparar dados |
| `t.apiOk(requisição, descrição)` | Espera a resposta e falha com "Pré-condição não atendida" se ela não for 2xx |

Use papéis e nomes visíveis (`getByRole`, `getByLabel`), como em `frontend/e2e/`, nunca coordenadas. Toda jornada termina num passo que confere o estado final no banco, e não só a tela.

**Se uma jornada falhar:**

1. Leia `evidence/<jornada>/summary.md`, com a falha e os problemas observados, e as capturas `falha-*.png`.
2. **Tempo esgotado:** leia `falha-memoria.txt` ou rode `free -m` e `vmstat 1 3` antes de atribuir ao código. Swap cheio com espera de E/S alta explica paradas de 5 a 6 s nesta máquina. Requisições lentas em vários pontos ao mesmo tempo apontam para a máquina; a mesma falha, repetida no mesmo passo com folga de memória, aponta para o código.
3. Para depurar: `cd frontend && npx playwright show-trace <evidence>/<jornada>/falha-<pessoa>-trace.zip`.
4. Uma jornada também falha, mesmo com todos os passos certos, por resposta 5xx ou erro de JavaScript na tela.

Uma falha que você não consiga explicar é o resultado da verificação. Relate-a; não a esconda repetindo até passar.

## Evidence

```bash
.claude/skills/verify-app/scripts/evidence.sh
```

Gera e imprime `evidence/SUMMARY.md`, com o commit, o resultado de cada fluxo do mapa, o que ficou como verificação manual ou sem cobertura, as linhas de erro no log do backend e o detalhe das jornadas.

| O que | Onde, em `.verify-app/runs/<execução>/` |
| --- | --- |
| Capturas de tela de cada passo | `evidence/<jornada>/NN-*.png` |
| Passos, estado final no banco e falhas | `evidence/<jornada>/summary.md` |
| Resumo da execução | `evidence/SUMMARY.md` |
| Vídeo, com `drive.sh --video <jornada>` | `evidence/<jornada>/video-*.webm` |
| Rastro do Playwright, só na falha | `evidence/<jornada>/falha-*-trace.zip` |
| Logs dos serviços | `logs/` |

A evidência fica nesta cópia do repositório: apagar o worktree apaga a evidência local junto.

**Para relatar:** diga o commit e o que foi provado, com o caminho de `SUMMARY.md`; o que ficou como não provado, sem arredondar; e o que depende do WhatsApp real. Uma jornada só prova o que está nos passos dela. O adaptador falso não prova o WhatsApp real.

**Linhas de erro no log do backend:** `context canceled` quer dizer que o cliente desistiu da requisição, por exemplo ao trocar de tela ou fechar a sessão. Hoje o backend registra isso como erro 500, mas a resposta não chega a ninguém, e por isso a contagem varia de uma execução para outra. Qualquer outra linha aparece no resumo e precisa de explicação antes de você dizer que a verificação passou, mesmo com todas as jornadas certas.

**Para levar a evidência a um PR:** só com capturas geradas pelas jornadas desta skill, com os dados falsos delas. Qualquer outra captura, por exemplo de um ambiente com dados reais, precisa de autorização do usuário.

```bash
.claude/skills/verify-app/scripts/publish-evidence.sh <número-do-PR>
```

O `gh` não envia imagens. Por isso, o script grava imagens e resumos num commit solto, apontado por `refs/verify-app/<execução>`, e comenta no PR com as imagens. Assim, nada entra na `main` nem em branch: o clone normal não baixa essa referência e o CI não roda nela. Ele não publica os rastros, que guardam requisições e cookies. **O repositório é público:** as imagens abrem para qualquer pessoa, sem login, e apagar a referência depois não garante que sumiram de cópias. Olhe as capturas antes de publicar. Cada execução publicada ocupa alguns megabytes, e a referência continua no repositório até ser apagada. O comando para apagar está no fim do comentário: rode depois do merge.

## Cleanup

```bash
.claude/skills/verify-app/scripts/cleanup.sh
```

Encerra só o que a execução iniciou: os processos que herdaram a marca `VERIFY_APP_RUN_ID=<execução>`, inclusive filhos como o Chromium, nunca por nome, e o contêiner registrado, depois de conferir o rótulo. Apaga senhas, binário, build e anexos. Preserva `evidence/` e `logs/`.

No fim, confere e diz que não restou processo, contêiner nem porta. Saída 1 quer dizer que algo restou: relate, sem encerrar nada na mão por nome de processo. Pode ser repetido. Para limpar uma execução anterior: `cleanup.sh <execução>`.

Rode `evidence.sh` de novo depois do Cleanup para o resultado dele entrar no resumo. As pastas de `.verify-app/runs/` não são apagadas sozinhas. Quando elas não forem mais necessárias, apague com `rm -rf .verify-app/runs/<execução>`.

## Helpers

Todos em `.claude/skills/verify-app/scripts/`, executáveis, sem depender de ferramentas de um agente específico.

| Script | Uso | O que faz |
| --- | --- | --- |
| `launch.sh` | `launch.sh` | Sobe a instância isolada |
| `doctor.sh` | `doctor.sh [execução]` | Confere a instância, só lendo |
| `drive.sh` | `drive.sh [--video] <jornada\|arquivo.mjs\|all> ...` | Conduz jornadas, uma de cada vez |
| `evidence.sh` | `evidence.sh [execução]` | Gera e imprime o resumo |
| `cleanup.sh` | `cleanup.sh [execução]` | Encerra o que a execução iniciou e confere |
| `publish-evidence.sh` | `publish-evidence.sh <PR> [execução]` | Leva a evidência ao PR |

Sem `[execução]`, vale a última criada nesta cópia do repositório. `common.sh` e `journey-lib.mjs` são carregados pelos outros e não são executados diretamente. As jornadas só rodam pelo `drive.sh`, que passa as variáveis e as senhas a elas.

**Ao mudar o produto:** se uma jornada falhar porque a tela mudou de propósito, atualize a jornada e o arquivo do fluxo no mesmo PR, sem tirar o que ela prova.
