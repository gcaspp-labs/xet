# Central de atendimento via WhatsApp

Documentos do projeto:

- [spec.md](spec.md): regras de negócio. É a fonte da verdade sobre o comportamento do sistema, até a migração para `docs/features/` (ver `docs/agents/domain.md`).
- [docs/architecture.md](docs/architecture.md): estado técnico atual: componentes, contrato da mensageria, bibliotecas padrão e estrutura do repositório.
- [docs/adr/](docs/adr/): decisões técnicas difíceis de reverter, com o motivo.
- [docs/data-model.md](docs/data-model.md): domínios, entidades, ligações, restrições e permissões. Migrações seguem este documento; mudanças no modelo são registradas nele antes da migração. As migrações antigas o citam pelo nome anterior, `modelo-dados.md`.
- [design.md](design.md): aplicação do design system da GCASPP LAB com shadcn/ui: tokens, tema, tipografia, componentes, ícones, marca e tom dos textos.
- Issues do GitHub: specs (rótulo `spec`) e os tickets delas como sub-issues; ideias e problemas com `needs-triage`. Rótulos em `docs/agents/labels.md`. As issues fechadas até a #103 com `ready-for-agent` são tasks do fluxo antigo (a issue #80 era a T80); as tasks T01 a T49 ficam só no histórico do git.
- [docs/pilot-validation.md](docs/pilot-validation.md): situação dos critérios de validação do piloto, roteiro de implantação e teste de reconexão.

## Fluxo de trabalho

O fluxo segue as skills de agente configuradas em `docs/agents/` (ver "Agent skills" abaixo):

- Problemas e ideias viram issues com `needs-triage` (skill `journal`) e passam pela triagem (`triage`).
- Uma mudança planejada vira uma spec (`to-spec`, rótulo `spec`), quebrada em tickets como sub-issues (`to-tickets`), com bloqueios nativos do GitHub e um rótulo de risco (`risk:low`, `risk:medium` ou `risk:high`). Tela nova ou mudança de layout passa antes pelo protótipo (`prototype`).
- Cada ticket é implementado pela skill `implement`, em branch própria, até o PR aberto com `Closes #NN`. Um ticket por vez, porque as portas são fixas, e só depois de todos os bloqueios fechados.
- O PR é revisado pela `code-review` e verificado no app pela `verify-app` quando toca a interface. Só a `merge-gate` faz merge sem a pessoa, e só de `risk:low`; os demais esperam a aprovação da pessoa. A `chief-of-staff` conduz a sequência.
- Quando todos os tickets de uma spec entram, a `to-docs` atualiza `docs/features/`. Só a pessoa fecha a spec.
- O ticket só termina quando todos os critérios de aceite forem atendidos e os testes passarem.
- Não implementar nada fora do escopo do ticket atual. Melhorias percebidas viram issue com `needs-triage`, não código.
- Se a spec não cobrir uma situação, parar e perguntar. A decisão tomada é registrada na spec antes de implementar.

## Testes

- Backend: somente testes de integração, pela API HTTP e pelos eventos do adaptador de mensageria. Não escrever testes unitários.
- Frontend: somente testes ponta a ponta com Playwright, rodando contra o backend real.
- Sempre com banco PostgreSQL próprio e real, criado para os testes (testcontainers), isolado de qualquer banco de desenvolvimento ou produção. Nunca mocks do banco.
- Toda regra de negócio é coberta por algum teste de integração ou ponta a ponta.
- Regras críticas exigem teste específico: assumir chamado com concorrência, apenas o responsável responde, um chamado aberto por contato e setor, idempotência de mensagens recebidas e enviadas, permissões por setor.
- O WhatsApp é simulado por um adaptador falso que implementa o contrato de mensageria; o Whatsmeow real só é usado em testes manuais com número de teste.
- Testes do backend rodam com `go test -race`.
- Cada teste de integração obtém seu próprio banco com `testdb.New(t)` (clonado de um modelo já migrado), podendo rodar em paralelo sem compartilhar estado.

## Idempotência, concorrência e consistência (ACID)

- Toda operação que altera mais de uma linha ou tabela roda em uma única transação. Auditoria é gravada na mesma transação da alteração.
- Disputas entre usuários são resolvidas no banco: atualização condicional (`update ... where status = ...`) ou `select ... for update`. Nunca ler, decidir no Go e gravar sem trava.
- Ações sobre um mesmo chamado (assumir, responder, transferir, encerrar, nova mensagem recebida) travam a linha do chamado na transação, para não haver, por exemplo, mensagem nova entrando num chamado que está sendo encerrado.
- Restrições do banco (únicos, checks, chaves estrangeiras) são a última barreira e precisam existir mesmo quando o código já valida. Erro de violação é tratado e convertido em resposta clara, nunca em erro 500.
- Mensagens recebidas são idempotentes pelo `external_message_id`: a mesma mensagem processada duas vezes não gera efeito duplicado.
- Mensagens enviadas são idempotentes pelo `client_request_id`: repetir a requisição devolve a mesma mensagem, sem reenviar.
- Envio ao WhatsApp acontece fora da transação: grava a mensagem como `pending`, confirma a transação, envia e atualiza o status. Mensagens `pending` antigas ao reiniciar o serviço são marcadas como `failed`, para o atendente reenviar; não há reenvio automático.
- Eventos para o WebSocket são publicados somente depois do commit da transação.
- Sem estado compartilhado em memória entre requisições além do necessário (conexões WebSocket e sessões do adaptador), protegido com os mecanismos de concorrência do Go.

## Adaptadores

- Usar adaptador apenas onde há troca prevista: mensageria (Whatsmeow → API oficial) e armazenamento de arquivos. Ver `docs/architecture.md`.
- Não criar interfaces, camadas ou repositórios genéricos sem uma segunda implementação prevista. O código de domínio usa sqlc e as bibliotecas diretamente.

## Código

- Nomes de código, banco, rotas e variáveis em inglês. Textos de interface, mensagens ao usuário e documentação em português.
- Toda tela segue o `design.md`: cores somente por tokens (nunca cores fixas ou a paleta padrão do Tailwind), componentes do shadcn adaptados ao design system e textos no tom do brand book.
- Usar somente as bibliotecas listadas em `docs/architecture.md`. Uma nova biblioteca exige justificativa registrada lá antes do uso.
- As regras de negócio nunca importam o Whatsmeow diretamente; passam pela interface de mensageria.
- Toda validação de permissão acontece no backend. A interface apenas reflete as regras.
- SQL escrito em `backend/db/queries` e gerado com `make sqlc` (o código gerado em `internal/db` não é editado à mão); mudanças de esquema somente por nova migração goose em `backend/db/migrations`, nunca alterando uma migração já mergeada.
- Alterações relevantes de chamados (transferência, correção, horários, troca de empresa) sempre gravam auditoria.

## Commits

- Conventional Commits com mensagem em português: `feat: assumir chamado com controle de concorrência`.
- Tipos: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.
- Commits pequenos e coerentes; lint e testes passando antes de cada commit.

## Comandos

Executados na raiz do repositório:

- `make dev`: banco de desenvolvimento em `:5440` (container `xet-dev-db`, dados persistidos), backend em `:8090` e frontend em `:5173`, com proxy de `/api` para o backend. `make dev-db-stop` para o banco. O frontend escuta em todas as interfaces e aceita o nome MagicDNS do Tailscale (`http://<máquina>.<tailnet>.ts.net:5173`), para testes manuais pelo celular. As portas do banco e do backend fogem das padrão (5432, 5433, 8080, 8081) porque outros projetos usam essas portas na mesma máquina; dentro do Docker Compose o backend continua em `:8080`.
- `make sqlc`: gera o código Go das queries.
- `make check-generated`: confere se o código do sqlc e o `go.mod` estão em dia com o commit (também roda no CI).
- `make test`: testes de integração do backend (`go test -race`, PostgreSQL via testcontainers) e ponta a ponta (Playwright, em portas próprias 18080, 18081 (API de CNPJ falsa) e 15173, com banco próprio em `:15432` criado e removido a cada execução).
- `make lint`: golangci-lint (via Docker) no backend; oxlint e Prettier no frontend.
- `make up` / `make down` / `make logs`: sistema completo com Docker Compose; requer `deploy/.env` (copiar de `deploy/.env.example`).
- `make create-admin NAME="Nome" EMAIL=email` (sistema do Compose) ou `make dev-create-admin NAME="Nome" EMAIL=email` (banco de desenvolvimento): cria um administrador; a senha é lida da entrada padrão.

## Agent skills

Configuração do fluxo com agentes, um arquivo por assunto em `docs/agents/`:

- Issues: GitHub `gcaspp-labs/xet`, pelo `gh`, com sub-issues e bloqueios nativos. `docs/agents/issue-tracker.md`
- Rótulos: categoria, triagem, `spec`, `in-progress`, `to-docs` e risco. `docs/agents/labels.md`
- Domínio e regras das funcionalidades: um contexto só; `spec.md` até a migração para `docs/features/`, modelo em `docs/data-model.md`. `docs/agents/domain.md`
- Design: `design.md` na raiz (GCASPP LAB com shadcn/ui); capturas só em desktop. `docs/agents/design.md`
- Comandos: main; `make dev`, `make test`, `make lint`, `make check-generated`; uma task por vez; evidência: `journeys`. `docs/agents/commands.md`
- Trava do merge: os 4 jobs do CI verdes; sem a pessoa, só `risk:low` sem área sensível. `docs/agents/merge-gate.md`
