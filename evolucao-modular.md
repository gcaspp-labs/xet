# Evolução modular: Contratos, bot e novos módulos

> **EM CONSTRUÇÃO. Não verificar, não implementar e não usar como referência até ordem do Thiago.**
>
> Este documento guarda o que foi discutido em novembro de 2026 para retomar com calma. Nada aqui é regra do sistema nem faz parte de `tasks.md`. A única parte já aprovada para execução é a reorganização de pastas (T30), que tem escopo próprio e não depende deste documento.

## Objetivo

O xet deixa de ser só atendimento e passa a reunir Contratos, vindo do ghubx-bot, e talvez RH e outros módulos. O ghubx já tem regras de contratos, alertas e o bot, mas não tem telas nem usuários.

## Decisões da entrevista

| Assunto | Decisão |
| --- | --- |
| Órgão (xet) e Cliente (ghubx) | Mesma entidade: uma tabela só |
| Módulo do atendimento e do contrato | Mesmo produto: um catálogo só |
| Uso de Contratos | Bot e telas web |
| Quando começar | Depois do xet no ar (T35); o ghubx não vai para produção separado |
| Permissões | Papel por módulo do sistema |
| Mais de um setor por usuário | Não agora, mas o desenho não pode impedir |
| Restrição dentro de Contratos | Só ler ou editar |
| Nextcloud | Aposentar, em fase própria, depois da junção |
| Motivo do desacoplamento | Só organização: sem venda a terceiros nem isolamento físico |
| RH | Indefinido: não entra nas fases |
| Servidor | Um só |
| Bot | Serviço do `core`, usado por qualquer módulo; as ferramentas ficam em cada módulo |

## Abordagem

**Um binário, um banco, um repositório.** As fronteiras são verificadas no CI, sem infraestrutura nova. Como o objetivo é só organização, ficam de fora:

- microsserviços, banco ou schema por módulo;
- sistema de plugins ou ligar e desligar módulos;
- barramento de eventos: módulos conversam por chamada de função, na mesma transação, o que preserva as regras ACID do `CLAUDE.md`;
- permissões configuráveis em tela (RBAC genérico);
- multiempresa.

**Custo aceito:** um deploy de Contratos reinicia o processo e derruba por instantes as conexões do WhatsApp, e as mensagens `pending` viram `failed`. Se isso incomodar, separar a mensageria é o primeiro candidato.

**Vocabulário:** "módulo" significa duas coisas, produto vendido (`modules`) e bloco do sistema (Contratos, Central). Antes de implementar, escolher um nome para o bloco no código e nas telas. A sugestão é `app`, como em `user_app_roles`.

## O que é de quem

Regra para criar um módulo do sistema: ele precisa ter ciclo de vida, regras e papéis próprios. Se não tiver, é uma tela de um módulo que já existe.

| Camada | Pastas | Tabelas |
| --- | --- | --- |
| **Core** | `core/auth`, `core/users`, `core/sectors`, `core/directory`, `core/audit`, `core/realtime`, `core/storage`, `core/httpx`, `core/bot` | `users`, `sessions`, `user_app_roles`, `user_identities`, `sectors`, `modules`, `sector_modules`, `organizations`, `contacts`, `contact_sectors`, `contact_modules`, `audit_logs` |
| **Central** | `helpdesk`, `helpdesk/messaging`, `helpdesk/audio` | `tickets`, `messages`, `media_files`, `internal_notes`, `ticket_modules`, `protocol_counters`, `sector_whatsapp_connections`, `whatsmeow_*` |
| **Contratos** | `contract` | `contracts`, `contract_items`, `client_modules`, `contract_alerts`, `contract_documents`, pastas do órgão no Nextcloud |

Regras de dependência (as duas primeiras já entram na T30):

1. O `core` nunca importa um módulo nem tem chave estrangeira para ele.
2. Um módulo importa o `core` e nunca outro módulo. Exceção só com decisão registrada em `arquitetura.md`.
3. Só o dono grava nas próprias tabelas. Um módulo pode ler o `core` por SQL (join); para ler outro módulo, usa uma função pública.
4. `internal/db` continua um pacote só. Dividir o sqlc duplicaria modelos sem ganho real neste cenário. As queries ficam em pastas por dono.

## Bot

O bot atende qualquer módulo, sem que o `core` conheça nenhum deles.

- `core/bot`: endpoint MCP, token, identidade de quem fala e registro de ferramentas.
- Cada módulo: expõe `Tools(reg)`, como faz com `Routes(r)`, com arquivos como `contract/register_mcp.go`.
- O Hermes (LLM, voz e Discord) continua em um container próprio, fora do binário.
- Cada ferramenta usa a mesma regra de negócio e a mesma verificação de papel da rota web.
- O registro por módulo permite manter um endpoint ou perfil do Hermes por módulo, para que o perfil de contratos não enxergue as ferramentas de RH.

**Identidade:** o autor nunca pode vir de um argumento preenchido pelo LLM, porque o texto de um PDF poderia influenciá-lo (injeção de prompt). A identidade do Discord precisa vir do gateway. Verificar antes de construir:

- **Se o Hermes repassar a identidade:** `user_identities(user_id, provider, external_id)` liga a conta ao usuário, e o papel vale também no bot.
- **Se não repassar:** um usuário de serviço do bot, sem login, com papel `editor`, mais a allowlist por cargo do Discord. Nesse caso a auditoria diz "pelo bot", mas não diz quem pediu, e ações sensíveis de outros módulos não deveriam ser abertas ao bot.

## Acoplamentos que precisam sair

A T30 só move pastas e mantém todos estes itens no banco. O último item sai de `core` já na T30, porque é mudança de código.

| Hoje | Problema | Mudança |
| --- | --- | --- |
| `sectors.phone`, `provider`, `external_account_id`, `connection_status`, `last_connected_at`, `connection_error` | Setor universal carrega WhatsApp | Mover para `sector_whatsapp_connections` |
| `audit_logs.ticket_id` → `tickets` | `core` aponta para um módulo | Usar `entity_type` e `entity_id`, depois de conferir se isso cobre todos os registros |
| `core/users` usa `CountInProgressTicketsOfAssignee` | `core` lê chamados | Definir como um módulo pode recusar a desativação de um usuário |
| `users.role` (`agent`, `supervisor`, `admin`) e `(role = 'admin') = (sector_id is null)` | Papéis de atendimento valem para todo o sistema, e todo não administrador precisa de setor | Ver Permissões |
| `modules.sector_id` | Catálogo preso ao setor | `modules` global e `sector_modules` (setor, módulo, ativo) |
| `organizations` plano; `clients` com hierarquia | Dois cadastros da mesma coisa | `organizations` ganha `parent_id`, `municipality` e `short_name`; `folder_path` fica em Contratos |
| `directory/contact_import.go` usa `messaging` | `core` dependeria da Central | Importação vai para `helpdesk` (T30) |

## Permissões

- `users.is_admin`: administrador global, com acesso a tudo.
- `user_app_roles(user_id, app, role)`, com chave em `(user_id, app)` e check nos pares válidos:
  - `ticket`: `agent`, `supervisor`
  - `contract`: `viewer`, `editor`
- `users.sector_id` vira opcional. Papel em `ticket` exige setor, validado na transação e garantido por restrição no banco.
- `core/auth` expõe uma única verificação de acesso por módulo (`RequireApp` nas rotas). As regras finas continuam em `helpdesk/access.go`, como "só o responsável responde".
- Toda consulta de setor do usuário passa por uma função só. É isso que permite ter vários setores no futuro sem refazer tudo.
- `/api/auth/me` devolve os papéis, e o menu do frontend reflete essa lista. Quem decide é sempre o backend.

## Trazer o ghubx

**Vem com adaptação:** `service/admin` (cerca de 1.900 linhas) vira `internal/contract`, incluindo renovação, backfill, alertas, dias úteis e visão do contrato. Também vêm `adapter/nextcloud`, `adapter/pdftext`, `transport/mcp` (dividido entre `core/bot` e `contract`) e o perfil do Hermes.

**Fica para trás ou é reescrito:**

- SQL manual (`adapter/postgres`, cerca de 770 linhas) → sqlc.
- Runner próprio de migrações → uma migração goose nova, com o esquema final.
- Validação de CNPJ duplicada → a do `core/directory`.
- Testes unitários de `domain` → integração, pela regra do xet. Regras de dias úteis precisam de cenários que passem pela API.
- Testes contra o Nextcloud real → adaptador falso nos testes do dia a dia.

**Interface só onde há troca prevista:** `DocumentStore` e `Calendar`, porque o Nextcloud será substituído.

**Exceção a registrar:** o ghubx altera banco e calendário na mesma operação, com compensação, enquanto o xet faz efeitos externos fora da transação. A compensação fica registrada como exceção de Contratos e some com o Nextcloud.

**Lacuna principal:** o ghubx não tem auditoria nem autor. Toda escrita de Contratos passa a gravar `audit_logs` na mesma transação.

## Implantação

Um único Compose no servidor:

- `postgres`, com um banco para o sistema e outro para o Nextcloud, enquanto ele existir;
- `backend`, com `/api` e `/api/ws` públicos e o endpoint MCP só na rede interna;
- Caddy ou Cloudflare Tunnel, com a escolha feita na T34;
- `hermes` (o perfil admin atual, com a pasta do `shared-inbox`);
- `nextcloud`, temporário.

Pontos de atenção:

- limite de memória do Hermes (hoje 4 GB, com STT local);
- backup único, cobrindo banco, volume de mídia e, enquanto existir, Nextcloud;
- as rotinas de backup e restauração da T19 do ghubx são reaproveitadas.

## Fases

Tarefas estimadas. Cada fase termina com o sistema em produção funcionando.

**Antes da Fase 0:**

- Xet termina as tasks do piloto e entra em produção.
- ghubx cancela a implantação separada. A migração para o Discord (T29 do ghubx) pode seguir, pois é quase só configuração do Hermes.
- Se a equipe já usa o bot na máquina de desenvolvimento com dados reais, o ghubx continua lá até a Fase 2, sem novas funcionalidades.

**Fase 0: decisões (1 task, só documentos)**

- Registrar as decisões em aberto.
- Dividir `spec.md` em core, central e contratos.
- Marcar o dono de cada tabela em `modelo-dados.md`.
- Trazer as regras do ghubx para a spec.

**Fase 1: separar os dados do core (cerca de 5 tasks, sem mudança visível)**

1. Pastas de queries por dono.
2. `sector_whatsapp_connections`.
3. `audit_logs` sem chave para `tickets`.
4. `user_app_roles`, `is_admin` e a verificação única de acesso, com tela de usuários por módulo.
5. Catálogo global de módulos e `organizations` com hierarquia.

Cada mudança de esquema sobre dados em produção usa a sequência: adicionar, copiar, trocar a leitura e só depois remover.

**Fase 2: Contratos no backend, com o bot (4 a 5 tasks)**

1. Verificação da identidade no Hermes.
2. Esquema, sqlc e `internal/contract`, com auditoria e testes portados.
3. `core/bot`, ferramentas em `contract` e Hermes no Compose.
4. Migração do ghubx: comando idempotente com simulação, que associa clientes a órgãos por CNPJ e gera lista de revisão manual para órgãos sem CNPJ e módulos com nomes diferentes.
5. Carga da planilha (a task já prevista no ghubx), virada e arquivamento do repositório `ghubx-bot`. Sem unir o histórico do Git.

**Fase 3: telas de Contratos (3 a 4 tasks)**

Lista e visão do contrato, cadastro e correção de termos, implantação de módulos e vencimentos. Tudo seguindo o `design.md`, com testes em Playwright e menu por papel.

**Fase 4: sair do Nextcloud (3 a 4 tasks)**

Telas de documentos e prazos, implementação de armazenamento próprio, migração dos arquivos com conferência por `sha256`, links do bot apontando para o sistema e desligamento.

**Custo a confirmar antes da Fase 4:** a equipe perde os apps de desktop e celular e o calendário assinável. Vale perguntar se quem usa o calendário no celular aceita notificações pelo bot ou um feed ICS.

**Depois:** RH ou outro módulo, se passar pela regra de criação. Se RH for de funcionários, os dados são pessoais e sensíveis (LGPD) e pedem análise própria, incluindo se a auditoria e os backups atuais bastam.

## Decisões em aberto

1. **CNPJ do órgão raiz:** obrigatório no ghubx, opcional no xet. Sugestão: opcional no banco e obrigatório para registrar contrato.
2. **Quem cria módulo no catálogo global:** hoje o supervisor cria no próprio setor. Sugestão: administrador cria o produto, supervisor liga ou desliga no setor.
3. **Módulos com nomes diferentes entre setores e no ghubx:** quem faz a equivalência. Sugestão: revisão manual única na migração.
4. **Contato no core:** `external_contact_id` e `registered` têm cara de WhatsApp. Sugestão: manter assim até outro módulo precisar de contatos.
5. **Nome do bloco do sistema:** `app`, como sugerido em Vocabulário, ou outro.

## Verificação prevista

- **Fronteiras:** `make lint` falha quando um módulo importa outro ou o `core` importa um módulo. Remover temporariamente `internal/contract` e suas rotas deve deixar o resto compilando e os testes da Central passando.
- **Fase 1:** `make test` passa sem alteração de comportamento nas regras críticas. Novos testes de integração cobrem permissões por módulo, como usuário sem papel recebendo 403 e usuário de Contratos sem setor.
- **Fase 2:** testes portados passam com `go test -race`. A migração roda em cópia dos dados reais, é executada duas vezes sem duplicar, e `get_contract_overview` bate com o sistema antigo e com a planilha em cada município.
- **Fase 2, manual:** bot pelo Discord registrando PDF, alerta diário e entrega; registro em `audit_logs` com o autor esperado.
- **Fase 3:** Playwright com perfis `viewer`, `editor` e sem acesso.
- **Fase 4:** contagem e `sha256` de todos os arquivos conferem antes de desligar; restauração de backup testada.
