# Tasks — Piloto (Contabilidade)

Histórico da implementação do piloto. As regras de negócio estão em [spec.md](spec.md), as decisões técnicas em [arquitetura.md](arquitetura.md), o modelo de dados em [modelo-dados.md](modelo-dados.md) e as regras de implementação em [CLAUDE.md](CLAUDE.md).

## Como usar

- **Este arquivo é histórico.** Desde 2026-11-05, as tasks são issues do GitHub com o rótulo `task`: `gh issue list --label task --state open`. Aqui ficam as concluídas até a T49, com o número que commits e PRs citam, e as ideias em avaliação.
- O número da task é o da issue, então as novas começam acima da #77 e não se confundem com as antigas.
- As regras de como escrever e rodar uma task estão nas skills `create-task` e `implement-task`.

## Fase 1 — Fundação

### [x] T01 — Estrutura do repositório

- Criar repositório git, estrutura `backend/`, `frontend/` e `deploy/`.
- Backend Go com chi, configuração por variáveis de ambiente, logs com slog e rota `/health`.
- Frontend Vite + React + TypeScript + Tailwind + shadcn/ui.
- Docker Compose com backend, PostgreSQL e Caddy servindo o frontend.
- Lint e testes configurados nos dois lados; `Makefile` com comandos `dev`, `test`, `lint`.

**Pronto quando:** `docker compose up` sobe o sistema, `/health` responde e o frontend abre pelo Caddy; lint e testes rodam sem erro.

### [x] T02 — Banco de dados base

- goose e sqlc configurados.
- Migrações iniciais conforme `modelo-dados.md`: setores, módulos, usuários e sessões.
- Base de testes de integração com testcontainers.

**Pronto quando:** migrações sobem e descem sem erro; um teste de integração grava e lê um setor.

### [x] T03 — Autenticação e papéis

- Login com e-mail e senha (bcrypt), sessão em tabela no PostgreSQL com cookie seguro.
- Papéis: atendente e supervisor do próprio setor, administrador global; middleware de autorização por setor conforme a tabela de permissões de `modelo-dados.md`.
- Redefinição de senha por administrador e supervisor.
- Comando para criar o primeiro administrador.
- Aplicar o design system conforme `design.md`: dependência fixada, tokens mapeados para o shadcn, tema claro/escuro, fontes IBM Plex, favicon e logos.
- Tela de login no frontend, seguindo o `design.md`.

**Pronto quando:** usuário loga e desloga; rotas protegidas recusam acesso sem sessão ou sem permissão no setor; testes cobrem as regras de permissão; a tela de login usa os tokens, fontes e logo do design system nos temas claro e escuro.

### [x] T18 — Integração contínua

- GitHub Actions a cada PR e a cada push na `main`, chamando os mesmos alvos do `Makefile` usados localmente.
- Jobs em paralelo: lint, testes de integração do backend, testes ponta a ponta e conferência do código gerado (sqlc e `go mod tidy`).
- Relatório do Playwright guardado como artefato quando os testes ponta a ponta falham.

**Pronto quando:** o workflow roda no PR e todos os jobs passam; uma alteração não gerada pelo sqlc ou um `go.mod` desarrumado fazem o job de código gerado falhar.

### [x] T04 — Administração

- Cadastro de setores (nome e número) e usuários (setor e papel).
- Supervisor gerencia módulos do próprio setor.
- Telas de administração.

**Pronto quando:** administrador cadastra a Contabilidade e seus usuários; supervisor cadastra módulos; atendente não acessa a administração.

### [x] T05 — Órgãos e contatos

- Cadastro de órgãos por supervisores e administradores (nome, CNPJ opcional com validação).
- Cadastro de contatos (nome, telefone único) vinculados a um órgão pré-cadastrado.
- Busca por nome, telefone e CNPJ.

**Pronto quando:** cadastro e busca funcionam pelas três chaves; telefone duplicado é recusado; testes cobrem validação de CNPJ e busca.

## Fase 2 — Conexão e recebimento

### [x] T06 — Camada de mensageria e Whatsmeow

- Contrato de mensageria com tipos neutros conforme `arquitetura.md` e adaptador falso para testes.
- Adaptador Whatsmeow em `internal/messaging/whatsmeow`, uma sessão por setor, sessões salvas no PostgreSQL.
- Tela de conexão com QR code; status da conexão e alerta de desconexão no painel dos supervisores.
- Reconexão automática ao reiniciar o serviço.

**Pronto quando:** o número de teste conecta por QR code, sobrevive a reinício do serviço e a desconexão aparece no painel.

### [x] T07 — Recebimento de mensagens e chamados

- Mensagem recebida cria chamado na fila do setor (com protocolo ano + sequência) ou entra no chamado aberto do contato.
- Índice único: um chamado aberto por contato e setor.
- Idempotência pelo `external_message_id`.
- Números desconhecidos entram na fila; grupos ignorados.
- Mensagens enviadas pelo celular registradas como "fora do sistema"; sem chamado aberto, criam chamado na fila.
- Mídia baixada e salva na chegada; tipos não suportados registrados como aviso.

**Pronto quando:** mensagens de texto e arquivo chegam e ficam gravadas; mensagem repetida não duplica; mensagem de grupo não gera chamado; testes cobrem cada regra.

### [x] T08 — Painel em tempo real e assumir chamado

- WebSocket com eventos filtrados pelos setores do usuário.
- Fila do setor, chamados por responsável e contagem de chamados ativos por atendente.
- Assumir chamado com atualização condicional.

**Pronto quando:** nova mensagem aparece no painel sem recarregar; teste de concorrência prova que apenas um atendente assume; usuário de outro setor não recebe eventos.

## Fase 3 — Atendimento

### [x] T09 — Conversa

- Enviar texto e arquivos; apenas o responsável responde (validado no backend); envio idempotente por `client_request_id`.
- Status de entrega das mensagens.
- Notas internas e campo "falou com".
- Histórico por órgão e contato.

**Pronto quando:** responsável conversa com o cliente pelo painel; outro atendente é bloqueado no backend mesmo chamando a API diretamente.

### [x] T10 — Áudio, imagens e vídeos

- Player de áudio no painel.
- Gravação de áudio no navegador, conversão com ffmpeg e envio como mensagem de voz.
- Pré-visualização de imagens e vídeos.

**Pronto quando:** áudio gravado chega ao celular como mensagem de voz; áudios, imagens e vídeos recebidos são exibidos no painel.

### [x] T11 — Iniciar conversa

- Buscar contato e iniciar conversa pelo número do setor, criando chamado atribuído ao atendente.
- Se já houver chamado aberto, direcionar para ele sem dar permissão de resposta.

**Pronto quando:** os dois caminhos funcionam e têm teste.

### [x] T12 — Transferência entre atendentes

- Transferir responsabilidade preservando histórico; registrar na auditoria.

**Pronto quando:** novo responsável responde, o anterior não; a transferência aparece no histórico.

### [x] T13 — Encerramento

- Formulário com assunto, resolução e módulos obrigatórios; cliente, atendente e setor automáticos; início e fim editáveis.
- Troca de órgão no encerramento, apenas para o chamado.
- Exigir vínculo cadastral para número desconhecido.
- Alterações de horário registradas na auditoria.
- Mensagem após o encerramento cria novo chamado.

**Pronto quando:** chamado só encerra com os dados completos; testes cobrem obrigatoriedade, vínculo e novo chamado após encerramento.

### [x] T14 — Correções com auditoria

- Corrigir atendimento encerrado com motivo, restrito a quem encerrou e aos supervisores.
- Auditoria com autor, data, motivo e valores anteriores e novos.

**Pronto quando:** correção sem motivo é recusada; atendente que não encerrou é bloqueado; a auditoria mostra a alteração.

### [x] T15 — Transferência entre setores

- Preencher o formulário de encerramento completo na origem, encerrar a etapa e criar chamado vinculado na fila do destino.
- Destino vê o histórico relacionado e envia a primeira mensagem (texto livre) ao assumir.

**Pronto quando:** cenário validado com um segundo número de teste.

## Fase 4 — Ajustes dos primeiros testes

Levantados nos primeiros testes com o número real e na revisão do código.

### [x] T20 — Organização do backend

Só reorganiza, para facilitar a leitura e reduzir conflitos nas tasks seguintes. Nenhuma regra, rota, resposta da API, consulta SQL ou migração muda. Cada passo vai em um commit próprio, para a revisão acompanhar com `git diff -M`.

- **Documentos:** corrigir `modelo-dados.md`, que cita o pacote `internal/message`, inexistente, e diz que `ticket` usa `sector`. As mensagens ficam em `internal/ticket`, e a lista de dependências precisa refletir os pacotes reais. Registrar em `arquitetura.md` a regra de um arquivo por assunto, com o mesmo nome em `httpapi` e `ticket`.
- **Dividir `ticket/conversation.go`** por assunto: `access.go` (`accessible`, `viewable`, `conducts`), `send.go` (envio, reenvio e recibos), `notes.go`, `media.go` e `history.go`.
- **Dar lugar ao que é do pacote `ticket`:** `service.go` com `Service`, `NewService` e os auxiliares (`recordTicket`, `isConstraint`, `optional`), hoje em `inbound.go`, `queue.go` e `close.go`; `errors.go` com os erros, hoje em 8 arquivos.
- **Parear `httpapi` com `ticket`:** por exemplo, `queue.go` (`listTickets`, `workload`, `assignTicket`), `transfer.go` e `transfer_sector.go`, que hoje estão em `tickets.go` e `close.go`, além de `send.go`, `notes.go`, `media.go` e `history.go`, que saem de `httpapi/conversation.go`. Os auxiliares de resposta saem de `router.go` para `respond.go`, junto com `ticketError` e `closingError`.
- **Nomes e repetição:** `ticketUserResponse` passa a `refResponse`, porque também serve a módulos, órgãos e setores; um auxiliar substitui as 16 repetições da leitura do ID do chamado nas rotas.

**Pronto quando:** os arquivos de teste não mudam e `go test -race`, `make lint` e `make test-e2e` passam; o diff só mostra código movido e os renomes previstos; `modelo-dados.md` descreve os pacotes reais; cada assunto de `ticket` tem o arquivo correspondente em `httpapi`, quando houver rota.

### [x] T20.1 — Leitura por camadas

Ajuste de processo, sem mudança no produto. A skill `/implement-task` lia seis documentos inteiros a cada task e passa a ler só o que a task precisa, sem esquecer regra de negócio.

- **Skill:** leitura por camadas, com gatilhos que obrigam a ler mais e registro, no PR, do que foi lido e do que ficou de fora.
- **Mapa:** cada task pendente ganha a linha `**Ler:**`, com as seções dos documentos e os arquivos de partida. "Permissões", em `modelo-dados.md`, passa a ser um título, para os gatilhos e os mapas poderem citá-la.
- **Piloto na T21:** comparar com a T13, task parecida, o quanto o contexto cresce até a primeira edição de código, e conferir se a revisão ou os testes encontram regra esquecida por falta de leitura. Se acontecer, acrescentar um gatilho; se repetir, voltar a ler a `spec.md` inteira nas tasks com regra de negócio.

**Pronto quando:** a skill descreve as camadas, os gatilhos e o registro do que foi lido; toda task pendente tem a linha `**Ler:**`, com títulos que existem nos documentos e arquivos que existem no repositório.

### [x] T21 — Fluxo do painel e realizados hoje

- "Assumir" no painel abre a conversa; a linha inteira do chamado também abre, com link esticado sobre a linha, sem perder o teclado, e o botão "Assumir" continua clicável.
- Encerrar e transferir para outro setor voltam ao painel. A correção continua na mesma tela.
- Consulta e rota dos atendimentos encerrados no dia, por setor, e card "Realizados hoje" no painel. O dia usa `protocolZone` (`internal/ticket/inbound.go`) e `closed_at`, com novo índice, e a lista é atualizada pelos avisos em tempo real do painel.
- Ajustar os e2e `panel`, `closing` e `transfer-sector`, que conferem a tela logo depois de assumir ou encerrar.

**Ler:** spec.md › Recebimento e distribuição; modelo-dados.md › Permissões, `tickets`; arquitetura.md › Tempo real; design.md; código: `ticket/queue.go` (modelo), `ticket/inbound.go` (`protocolZone`), `httpapi/queue.go`, `httpapi/router.go`, `db/queries/tickets.sql`, `db/migrations/`, `src/pages/PanelPage.tsx`, `src/lib/tickets.ts`, `src/lib/realtime.ts`, `src/pages/ticket/TicketPage.tsx`, `src/components/ClosingSheet.tsx`, `httpapi/panel_test.go`, `e2e/panel.spec.ts`, `e2e/closing.spec.ts`, `e2e/transfer-sector.spec.ts`.

**Pronto quando:** assumir leva ao chat; ao encerrar, a pessoa volta ao painel e o atendimento aparece nos realizados, com "Você" nos próprios e os transferidos identificados; outro setor não vê; encerrados de ontem não aparecem.

### [x] T22 — Cancelar atendimento

- Duas migrações: novo valor `cancelled` em `closure_type` numa e, na seguinte, as restrições `tickets_closed_fields` e `audit_logs_correction_reason`. O Postgres não permite usar um valor de enum na mesma transação em que ele é criado.
- `POST /api/tickets/{id}/cancel` com motivo, travando o chamado como `closeLocked` (`internal/ticket/close.go`). Vindo da fila, grava quem cancelou como responsável, porque `tickets_assigned` exige responsável em chamado encerrado.
- Botão na tela do chamado, com formulário de motivo e volta ao painel. A conversa mostra quem cancelou e o motivo; histórico e realizados mostram "Cancelado".
- A correção recusa chamado cancelado.

**Ler:** spec.md › Cancelamento; modelo-dados.md › Tipos enumerados, Permissões, `tickets`, Ciclo de vida do chamado, `audit_logs`; design.md; código: `ticket/close.go` (`closeLocked`, modelo), `httpapi/close.go`, `ticket/correct.go`, `ticket/transfer.go` (`AssignmentLogs`), `ticket/history.go`, `db/queries/tickets.sql`, `db/queries/audit_logs.sql`, `db/migrations/`, `src/pages/ticket/TicketPage.tsx`, `src/pages/PanelPage.tsx`, `src/components/ClosingSheet.tsx`, `src/components/TicketHistory.tsx`, `httpapi/close_test.go`, `httpapi/correct_test.go`, `e2e/closing.spec.ts`.

**Pronto quando:** fila e atendimento seguem as permissões, com teste de atendente que não é o responsável; motivo em branco é recusado; contato não cadastrado cancela sem órgão; cancelar não cruza com assumir nem com mensagem nova, e a mensagem seguinte abre outro chamado; a correção é recusada; a auditoria grava o motivo na mesma transação.

### [x] T23 — Devolver à fila

- Ação na tela do chamado em atendimento, com volta ao painel, travando o chamado como em `Transfer` (`internal/ticket/transfer.go`); auditoria `ticket_returned` com `recordTicket` e registro na conversa.

**Ler:** spec.md › Devolver à fila; modelo-dados.md › Permissões, Ciclo de vida do chamado, `audit_logs`; design.md; código: `ticket/transfer.go` (`Transfer`, modelo), `httpapi/transfer.go`, `ticket/service.go` (`recordTicket`), `db/queries/tickets.sql`, `db/queries/audit_logs.sql`, `src/pages/ticket/TicketPage.tsx`, `src/components/TransferSheet.tsx`, `httpapi/transfer_test.go`, `e2e/transfer.spec.ts`.

**Pronto quando:** responsável, supervisor e administrador devolvem, e outro atendente não; chamado na fila ou encerrado é recusado; o chamado volta à fila e outra pessoa assume; `assigned_at` se mantém.

### [x] T24 — Arquivo recebido que não baixa

- Novo tipo `media_unavailable` em `message_type`, com aviso na conversa e na última mensagem do painel.
- No adaptador Whatsmeow, conferir o tamanho informado antes de baixar (limite de 100 MB) e tentar o download algumas vezes. Hoje a falha devolve erro, e a mensagem não entra no chamado enquanto o download falhar (`internal/messaging/whatsmeow/messages.go`).

**Ler:** spec.md › Conversa; modelo-dados.md › Tipos enumerados, `messages`; arquitetura.md › Contrato; design.md; código: `messaging/whatsmeow/messages.go`, `messaging/messaging.go`, `messaging/fake/fake.go`, `messaging/fake/http.go`, `ticket/inbound.go` (`saveMedia`), `db/migrations/`, `src/lib/tickets.ts` (`lastMessagePreview`), `src/pages/ticket/TicketPage.tsx`, `httpapi/inbound_test.go`, `e2e/media.spec.ts`.

**Pronto quando:** pelo adaptador falso, a mensagem com arquivo indisponível vira aviso no chamado e a reentrega não duplica; há verificação manual com o número real, enviando um arquivo acima do limite.

### [x] T25 — Usuário com chamados em atendimento

- `UpdateUser` (`internal/auth/auth.go`) recusa a desativação e a troca de setor, inclusive ao virar administrador, se houver chamados em atendimento, informando a quantidade. A tela de usuários mostra a mensagem.

**Ler:** spec.md › Administração; modelo-dados.md › `users`; design.md; código: `auth/auth.go` (`UpdateUser`), `httpapi/users.go`, `db/queries/users.sql`, `db/queries/tickets.sql`, `src/pages/admin/UsersPage.tsx`, `httpapi/admin_test.go`, `e2e/admin.spec.ts`.

**Pronto quando:** desativar e trocar de setor são recusados com chamados e passam depois de transferir; editar o nome ou o e-mail continua livre.

### [x] T26 — Telefone do setor pelo QR code

- Migração: `sectors.phone` opcional e nova coluna `connection_error`. O telefone sai do formulário e da API de setores.
- O evento de conexão passa a informar o telefone da conta (no Whatsmeow, de `Store.ID`). `HandleConnection` (`internal/sector/connection.go`) grava o telefone e o apaga em `logged_out`.
- Número já ligado a outro setor (`sectors_phone_key`): grava o motivo e desvincula o aparelho fora da transação e fora do tratamento do evento. A tela de conexão mostra o motivo.
- Informar um tipo de plataforma conhecido em `store.DeviceProps` (`internal/messaging/whatsmeow/whatsmeow.go`): com o tipo desconhecido, o celular mostra "Outro dispositivo" em vez de "Central de Atendimento". Essas informações só são enviadas no pareamento, então um número já conectado precisa ler o QR code de novo.
- Botão "Desvincular número" na tela de conexão, com confirmação, e `DELETE /api/sectors/{id}/connection`, para supervisor do setor e administrador. Usa o `Disconnect` que o contrato de mensageria já tem e que hoje nenhuma rota chama, depois de gravar o estado com o autor (ver `arquitetura.md`), porque o evento emitido pelo adaptador não tem autor.
- As telas mostram "Não conectado" sem telefone. Ajustar `seedSector` (`frontend/e2e/fixtures.ts`) e os testes de setor e de conexão.

**Ler:** spec.md › Administração; modelo-dados.md › `sectors`, Permissões, `audit_logs`; arquitetura.md › Contrato, Conexão do número, Adaptador falso; design.md; código: `sector/connection.go`, `sector/sector.go`, `httpapi/connection.go`, `httpapi/sectors.go`, `messaging/messaging.go`, `messaging/whatsmeow/whatsmeow.go`, `messaging/fake/fake.go`, `messaging/fake/http.go`, `db/queries/sectors.sql`, `db/migrations/`, `src/pages/connection/ConnectionPage.tsx`, `src/pages/admin/SectorsPage.tsx`, `src/lib/connection.ts`, `src/lib/admin.ts`, `httpapi/connection_test.go`, `httpapi/admin_test.go`, `e2e/connection.spec.ts`, `e2e/admin.spec.ts`, `e2e/fixtures.ts`.

**Pronto quando:** conectar preenche o telefone; número de outro setor é recusado com o motivo na tela, sem erro 500; uma queda temporária mantém o telefone e desvincular o apaga; há verificação manual com o número real, em que o celular deixa de mostrar "Outro dispositivo"; supervisor e administrador desvinculam, atendente e supervisor de outro setor não; desvincular grava a auditoria com o autor, repetir não gera novo registro e o setor volta a conectar pelo QR code.

### [x] T27 — Setores e módulos do contato

- Migração das tabelas `contact_sectors` e `contact_modules`, preenchendo os setores a partir dos chamados existentes.
- Setores (ao menos um) e módulos opcionais no cadastro do contato (`ContactSheet`). Rota de leitura dos módulos ativos para todos os papéis, porque a atual é restrita à supervisão.
- Filtros de setor e módulo na busca de contatos: "Meu setor" por padrão, com opção de todos; "Nova conversa" usa o mesmo filtro.
- Vínculo automático na transação do recebimento, da nova conversa e da transferência entre setores.
- `closing-form` devolve os módulos do contato entre os ativos do setor, e o `ClosingSheet` os marca.

**Ler:** spec.md › Setores e módulos do contato, Formulário de encerramento; modelo-dados.md › `contacts`, `contact_sectors`, `contact_modules`, `modules`; design.md; código: `directory/directory.go`, `httpapi/contact.go`, `ticket/contact.go`, `ticket/inbound.go`, `ticket/start.go`, `ticket/transfer_sector.go`, `ticket/close.go` (`ClosingForm`), `httpapi/close.go`, `httpapi/sectors.go` (`listModules`), `db/queries/contacts.sql`, `db/queries/modules.sql`, `db/migrations/`, `src/components/ContactSheet.tsx`, `src/components/ClosingSheet.tsx`, `src/components/NewConversationSheet.tsx`, `src/pages/directory/ContactsPage.tsx`, `src/lib/directory.ts`, `src/lib/closing.ts`, `httpapi/directory_test.go`, `httpapi/inbound_test.go`, `httpapi/start_test.go`, `httpapi/transfer_sector_test.go`, `httpapi/close_test.go`, `e2e/directory.spec.ts`.

**Pronto quando:** o filtro "Meu setor" funciona e o administrador abre em todos; mensagem, nova conversa e transferência criam o vínculo sem duplicar; módulo fora dos setores do contato é recusado; os módulos vêm marcados no encerramento e podem ser alterados.

### [x] T28 — Cadastrar contato em "Nova conversa"

- Botão em `NewConversationSheet` que abre o `ContactSheet` por cima, como o `ClosingSheet` já faz. O `ContactSheet` passa a devolver o contato salvo, que fica escolhido para a primeira mensagem.

**Ler:** spec.md › Iniciar conversas; design.md; código: `src/components/NewConversationSheet.tsx`, `src/components/ContactSheet.tsx`, `src/components/ClosingSheet.tsx` (modelo), `e2e/start-conversation.spec.ts`.

**Pronto quando:** dá para cadastrar um contato e enviar a primeira mensagem sem sair da tela; telefone já cadastrado mostra o aviso sem fechar a conversa.

### [x] T29 — Importar contatos do WhatsApp

- Interface opcional `ContactBook`, no padrão de `QRPairing` (`internal/messaging/messaging.go`), no adaptador Whatsmeow (`Store.Contacts.GetAllContacts`, com telefone resolvido quando o contato vem por LID) e no falso. Só entram contatos com nome salvo e telefone.
- Levar `phoneVariants` (`internal/ticket/inbound.go`) para `internal/directory`, para usar a mesma regra do nono dígito.
- Botão "Importar contatos" na tela de contatos: lista com seleção e "selecionar todos", órgão opcional para o lote e resumo do resultado. O cliente envia só os telefones escolhidos; os nomes são lidos de novo no servidor.
- Importação numa única transação, com auditoria `contacts_imported`. Avisar quando o número estiver desconectado ou o provedor não tiver agenda.

**Ler:** spec.md › Importar contatos do WhatsApp; modelo-dados.md › Permissões, `contacts`, `contact_sectors`, `audit_logs`; arquitetura.md › Contrato; design.md; código: `messaging/messaging.go` (`QRPairing`, modelo), `messaging/whatsmeow/whatsmeow.go`, `messaging/fake/fake.go`, `messaging/fake/http.go`, `ticket/inbound.go` (`phoneVariants`), `directory/directory.go`, `httpapi/contact.go`, `db/queries/contacts.sql`, `src/pages/directory/ContactsPage.tsx`, `src/lib/directory.ts`, `httpapi/directory_test.go`, `e2e/directory.spec.ts`.

**Pronto quando:** importa selecionados e todos, com e sem órgão; repetir a importação e a variante do nono dígito não duplicam nem sobrescrevem, só vinculam o setor; atendente não importa de outro setor; há verificação manual com o número real.

### [x] T30 — Reorganizar o backend por módulos

Só muda onde o código fica, para ler o backend por funcionalidade. Comportamento, API, banco e frontend não mudam.

- Estrutura em `backend/internal/`:
  - `core/`, o que serve a todos os módulos: `auth` (login, sessão, permissões e middlewares), `users` (cadastro de usuários e senhas), `sectors` (setores e módulos), `directory` (órgãos e contatos), `audit`, `realtime`, `storage` e `httpx` (hoje `httpapi/respond.go`).
  - `helpdesk/`, a central de atendimento: o conteúdo de `ticket/` e as rotas dele, a conexão do número (hoje em `sector/`), a importação da agenda (hoje em `directory/`), `messaging/` e `audio/`.
  - `server/` só monta o roteador; `testapi/` sobe o servidor para os testes. `db/`, `config/` e `testdb/` ficam onde estão.
- Dentro de cada módulo, um trio por assunto: `transfer.go` (regra), `transfer_http.go` (rota) e `transfer_test.go` (testes, em pacote externo). A pasta `httpapi` deixa de existir.
- Cada módulo expõe `Routes(r chi.Router)`. Todas as URLs continuam iguais.
- `core` não importa módulos e um módulo não importa outro; os dois garantidos por `depguard` em `backend/.golangci.yml`.
- `sector.go` guarda um `messaging.Provider` (`SetProvider`), que precisa sair de lá para o `core` não importar `helpdesk`. Se isso exigir mudança de comportamento, parar e perguntar.
- Ficam como estão, porque exigiriam mudar o banco ou uma regra: `core/users` consulta os chamados em andamento do usuário; `sectors` mantém as colunas do WhatsApp, gravadas por `helpdesk/connection.go`; `audit_logs` mantém a chave para `tickets`.
- Atualizar `arquitetura.md` (Estrutura do repositório e "Um arquivo por assunto") e `modelo-dados.md` (Domínios e dependências) antes de mover o código, e depois os caminhos da skill `/implement-task` (passo 2) e das linhas `**Ler:**` das tasks pendentes.
- Commits pequenos, por módulo, sempre compilando e com os testes passando.

**Ler:** arquitetura.md › Estrutura do repositório; modelo-dados.md › Domínios; código: `httpapi/router.go`, `httpapi/respond.go`, `auth/auth.go`, `sector/sector.go`, `sector/connection.go`, `directory/contact_import.go`, `ticket/service.go`, `cmd/server/main.go`, `httpapi/auth_test.go` (auxiliares dos testes), `backend/.golangci.yml`.

**Pronto quando:** `make lint`, `make test` e `make check-generated` passam; a lista de métodos e URLs extraída com `chi.Walk` é idêntica antes e depois; o número de funções `Test*` não diminui e nenhuma asserção muda; uma importação proibida colocada de propósito faz o `make lint` falhar; `git diff main -- backend/db/migrations backend/db/queries frontend/` fica vazio; login, abrir um chamado e enviar mensagem funcionam no `make dev`.

### [x] T31 — Menu de configurações e tema

- Botão "Configurações" no rodapé da barra lateral (`AppLayout`), com "Sair" e tema Claro, Escuro ou Sistema. Adicionar o `DropdownMenu` do shadcn, sem biblioteca nova.
- Escolha guardada no `localStorage` e aplicada antes de pintar a tela; `color-scheme` no CSS e `sonner` acompanhando o tema (hoje fixo em `system`).
- Ajustar o e2e `auth`, que clica em "Sair".

**Ler:** arquitetura.md › Frontend (React); design.md; código: `src/components/AppLayout.tsx`, `index.html`, `src/main.tsx`, `src/index.css`, `e2e/auth.spec.ts`.

**Pronto quando:** o tema persiste ao recarregar e vale também na tela de login; "Sistema" segue o sistema operacional; "Sair" funciona pelo menu; o menu funciona por teclado.

### [x] T32 — Player de áudio próprio

- Componente sobre `<audio>` sem controles nativos, com tocar e pausar, progresso e tempo, usado na gravação (`Composer`) e nas mensagens (`MessageMedia`, em `TicketPage`). A duração aparece uma única vez.

**Ler:** spec.md › Conversa; arquitetura.md › Áudio e mídia; design.md; código: `src/pages/ticket/TicketPage.tsx` (`MessageMedia`, `Composer`), `e2e/media.spec.ts`.

**Pronto quando:** o áudio toca e avança na gravação e nas mensagens, nos dois temas; a barra funciona por teclado; o botão de enviar continua visível em tela estreita.

## Fase 5 — Pós-MVP

Ajustes para fazer antes de escalar para outros setores, levantados durante o piloto.

### [x] T33 — Reforço da autenticação

- Limitar tentativas de login por e-mail e por IP, com bloqueio temporário após falhas seguidas, contra força bruta.
- Recusar senhas comuns ou vazadas (lista de senhas conhecidas), como recomenda o NIST SP 800-63B-4.
- Limpar periodicamente as sessões expiradas, inclusive de usuários que não voltam a fazer login.

A autenticação em dois fatores saiu desta task e foi para a T36.

**Ler:** spec.md › Usuários e acesso; modelo-dados.md › `users`, `sessions`, `audit_logs`; arquitetura.md › Autenticação; design.md; código: `core/auth/auth.go`, `core/auth/auth_http.go`, `core/users/users.go`, `db/queries/sessions.sql`, `db/queries/users.sql`, `db/migrations/`, `src/pages/LoginPage.tsx`, `src/lib/auth.ts`, `core/auth/auth_test.go`, `e2e/auth.spec.ts`.

**Pronto quando:** login bloqueia após o limite de tentativas; senha comum é recusada; sessões expiradas são removidas sem depender de novo login; testes cobrem cada regra.

## Fase 7 — Órgãos, municípios e contatos

Levantadas nos testes da interface. Podem rodar antes das pendentes acima: como a skill `/implement-task` para ao encontrar task anterior pendente, é só confirmar para ela seguir.

### [x] T37 — Municípios no cadastro de órgãos

- Nova tabela `municipalities`, com nome e código AUDESP, e `organizations.municipality_id` obrigatório, em migração única. A carga dos municípios fica na própria migração.
- Índice único do nome do órgão por município; a violação vira resposta clara, nunca erro 500.
- Rota de leitura dos municípios para os papéis que usam o formulário de órgão, sem cadastro. Tela de órgãos com o campo de município, em seletor com busca (são 645).
- Mostrar o município ao lado do órgão nas listas, buscas e detalhes, como o seletor de órgão, a lista de contatos, o painel, o chamado e o encerramento.
- Ajustar `testapi` e as fixtures do `e2e`, que hoje criam órgãos só com nome e CNPJ.

**Carga dos municípios:** baixar as duas planilhas da [página do TCE-SP](https://www.tce.sp.gov.br/audesp/documentacao/cadastro-institucional), pedindo permissão antes. Elas servem só para gerar o SQL e não entram no repositório.

- [Códigos Audesp dos Municípios](https://www.tce.sp.gov.br/sites/default/files/audesp-documentacao/audesp_codigos_dos_municipios_2.xls) dá o código: 645 linhas, 4 dígitos, nomes em maiúsculas e sem acento.
- [Códigos Audesp das Entidades](https://www.tce.sp.gov.br/sites/default/files/audesp-documentacao/orgaos-audesp-codigo-2018-09-04.xlsx) dá o nome com acento. Nela, 20 códigos perderam o zero à esquerda (`790` é `0790`).
- Não carregar `9996` (AUDeSP-04) e `9999` (OUTROS), que só aparecem nas entidades e não são municípios.
- Sete nomes divergem; confirmar a grafia oficial e usar a atual: Embu / Embu das Artes, Florinea / Florínia, Luiz Antonio / Luís Antônio, São João do Iracema / São João de Iracema, São João do Pau Dalho / São João do Pau d'Alho, São Luiz do Paraitinga / São Luís do Paraitinga, Sud Menucci / Sud Mennucci.
- Os órgãos continuam cadastrados à mão: a planilha de entidades é de 2018, não tem CNPJ e inclui 929 secretarias e diretorias do Estado.

**Dados existentes:** só há órgãos de teste. A migração falha em banco com órgãos, então o banco de desenvolvimento precisa ser recriado, depois de confirmar com o usuário, porque apaga os dados de teste dele. O `Makefile` não tem comando para isso: é `docker rm -f xet-dev-db` seguido de `docker volume rm xet-dev-db`; o `make dev-restart` cria o banco de novo. Se já houver órgãos reais quando a task começar, parar e perguntar.

**Ler:** spec.md › Órgãos e contatos; modelo-dados.md › `municipalities`, `organizations`, Permissões, `audit_logs`; design.md; código: `core/directory/directory.go`, `core/directory/directory_http.go`, `db/queries/organizations.sql`, `db/queries/contacts.sql`, `db/migrations/`, `testapi/testapi.go`, `core/directory/directory_test.go`, `src/pages/directory/OrganizationsPage.tsx`, `src/components/ContactSheet.tsx` (`OrganizationPicker`), `src/lib/directory.ts`, `e2e/fixtures.ts`, `e2e/directory.spec.ts`.

**Pronto quando:** os 645 municípios estão carregados, com código único e zero à esquerda preservado; cadastrar e editar órgão exige município existente, com auditoria; nome repetido no município é recusado sem diferenciar maiúsculas e acentos, e aceito em outra cidade; atendente não cadastra órgão; o município aparece ao lado do órgão.

### [x] T38 — Filtro por município e órgão nos contatos

- Filtros de município e de órgão em `ContactFilters`, valendo em "Nova conversa" e na lista de contatos. O de município mostra só os que têm órgão cadastrado; o de órgão acompanha o município escolhido.
- `SearchContacts` passa a aceitar os dois filtros e a buscar pelo nome do município, com índice próprio se necessário.
- Filtro com valor inválido responde 422, como os de setor e módulo.

**Ler:** spec.md › Órgãos e contatos, Iniciar conversas; modelo-dados.md › `organizations`, `contacts`; design.md; código: `core/directory/directory.go`, `core/directory/directory_http.go`, `db/queries/contacts.sql`, `core/directory/directory_test.go`, `src/components/ContactFilters.tsx`, `src/components/NewConversationSheet.tsx`, `src/pages/directory/ContactsPage.tsx`, `src/lib/directory.ts`, `e2e/directory.spec.ts`, `e2e/start-conversation.spec.ts`.

**Pronto quando:** nas duas telas, escolher município ou órgão mostra só os contatos correspondentes, combinando com setor, módulo e texto digitado; a lista de órgãos acompanha o município; buscar o município, com ou sem acento, encontra os contatos dos órgãos dele.

### [x] T39 — Cadastrar o contato durante o atendimento

- Aviso no topo da conversa e botão junto do contato no painel lateral, só em chamado aberto com contato não cadastrado, abrindo o `ContactSheet`.
- Nesse caminho, o órgão é opcional. Sem órgão, uma rota própria grava só o nome e mantém `registered = false`; o formulário deixa claro que os demais dados não são salvos. Com órgão, vale o cadastro completo que já existe.
- A rota do nome recusa contato já cadastrado com resposta clara e, como a edição de contato hoje, não grava auditoria.
- Conferir se o nome novo chega às outras telas abertas, com evento publicado depois do commit. O encerramento e a transferência continuam exigindo o cadastro completo.

**Ler:** spec.md › Órgãos e contatos, Formulário de encerramento; modelo-dados.md › `contacts`, Permissões, `audit_logs`; design.md; código: `src/pages/ticket/TicketPage.tsx`, `src/components/ContactSheet.tsx`, `src/components/ClosingSheet.tsx` (modelo), `core/directory/directory.go`, `core/directory/directory_http.go`, `db/queries/contacts.sql`, `helpdesk/inbound.go`, `core/directory/directory_test.go`, `e2e/directory.spec.ts`, `e2e/closing.spec.ts`.

**Pronto quando:** dá para salvar só o nome, sem encerrar e sem assumir, e ele aparece na conversa, no painel e na lista de contatos; nova mensagem recebida não troca o nome salvo; só com o nome, o aviso continua e o encerramento pede o órgão; o cadastro completo tira o aviso, e o chamado aberto recebe o órgão, com auditoria; contato já cadastrado e chamado encerrado não mostram o aviso.

### [x] T40 — Consulta de CNPJ no cadastro de órgão

Antes de implementar, escolher a API e registrar a justificativa em `arquitetura.md`, avaliando limites, custos, dados devolvidos e suporte ao CNPJ alfanumérico. Opções a avaliar: BrasilAPI, ReceitaWS e CNPJá. Se ela devolver o código IBGE, avaliar guardá-lo em `municipalities` para achar o município sem depender da grafia.

- Botão de consulta no formulário de órgão, para supervisores e administradores, com a chamada saindo do backend, fora de qualquer transação.
- Sugere nome e município, sem salvar nada; município não encontrado fica para escolher à mão. Nenhum dado extra é guardado por enquanto.
- Falha ou CNPJ não encontrado mostram aviso e mantêm o cadastro manual.

**Ler:** spec.md › Órgãos e contatos; modelo-dados.md › `municipalities`, `organizations`, Permissões; arquitetura.md › Bibliotecas padrão; design.md; código: `core/directory/directory.go`, `core/directory/directory_http.go`, `core/directory/directory_test.go`, `src/pages/directory/OrganizationsPage.tsx`, `src/lib/directory.ts`, `e2e/directory.spec.ts`.

**Pronto quando:** com um servidor falso no lugar da API, sem chamar o serviço real, a consulta sugere os dados e nada é salvo sem confirmação; CNPJ não encontrado e API fora do ar não impedem o cadastro manual; atendente não consulta; há verificação manual com a API real.

## Fase 8 — Publicação, navegação e notificações

Para as tasks desta fase, a skill `/implement-task` para porque T34, T35 e T36 continuam abertas, e a T40 enquanto o PR dela não for mergeado. É só confirmar para ela seguir.

### [x] T41 — Publicação por Cloudflare Tunnel e Access

Publica o sistema em `https://atendimento.gcaspp.com.br`, sem porta aberta no servidor. O código é entregue aqui; a parte no painel da Cloudflare, no Registro.br e no servidor é do usuário, seguindo o roteiro. Avise-o no resumo final dos lembretes marcados abaixo. A implantação em si e os critérios com o número real continuam na T34.

- `deploy/compose.yml`: serviço `cloudflared` com imagem de versão fixa e token vindo do `.env`, nunca do repositório; tirar a publicação das portas 80 e 443 do serviço `web`.
- `deploy/.env.example`: token do túnel, `SITE_ADDRESS=:80` e `COOKIE_SECURE=true`. O HTTPS termina na Cloudflare e o cookie continua `Secure`, porque o navegador fala HTTPS.
- **Limite de login:** hoje o Caddy grava em `X-Forwarded-For` o IP de quem conecta nele, que passaria a ser sempre o `cloudflared`, e o backend usa esse valor (`clientIP`, em `core/auth/auth_http.go`). Sem ajuste, 30 tentativas erradas de qualquer pessoa bloqueiam o login de todos por 15 minutos. `deploy/Caddyfile` deve gravar nele o `CF-Connecting-IP`. O Caddy só pode ser alcançado pelo túnel, para o cabeçalho não ser forjado.
- `validacao-piloto.md`: atualizar "Situação" e "Roteiro de implantação" (o passo 1 ainda fala em portas abertas), e incluir "Teste da implantação" para o novo caminho. O roteiro traz, nesta ordem:
  1. Criar a conta da Cloudflare com dois fatores e adicionar `gcaspp.com.br`, no plano gratuito, que exige mover o DNS do domínio inteiro.
  2. **Lembrete ao usuário:** antes de trocar os nameservers no Registro.br, conferir no painel da Cloudflare os 5 registros MX e o SPF do Google. Valores conferidos no DNS público em 2026-11-02: MX `1 aspmx.l.google.com`, `5 alt1.aspmx.l.google.com`, `5 alt2.aspmx.l.google.com`, `10 aspmx2.googlemail.com`, `10 aspmx3.googlemail.com`; TXT `v=spf1 include:_spf.google.com ~all`. Nameservers atuais: `nsa1` a `nsa6.hostnet.com.br`. O site atual não está em uso (responde erro 500) e não precisa ser preservado.
  3. Trocar os nameservers no Registro.br. **Lembrete ao usuário:** depois da troca, testar enviar e receber e-mail.
  4. Criar o túnel apontando `atendimento.gcaspp.com.br` para `http://web:80`, sem reescrever o `Host`, porque o WebSocket confere a origem.
  5. Ativar "Always Use HTTPS" e uma regra para não fazer cache de `/api/*`.
  6. Criar a aplicação no Cloudflare Access com duas regras: liberar o IP do escritório e, para os demais, código por e-mail só para os e-mails da equipe. Com o IP alterado, o escritório passa a pedir o código, sem ficar sem acesso. Antes, confirmar com o provedor que o IP é fixo (o usuário acredita que sim) e o limite de usuários do plano gratuito.
  7. Só usar dados reais depois da avaliação de LGPD (`spec.md`, Estrutura e implantação).

A consulta que orientou esta task está nas referências: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) e [políticas do Access](https://developers.cloudflare.com/cloudflare-one/policies/access/). Limites de planos e o suporte a WebSocket não estavam nessas páginas: confirme no teste.

**Ler:** spec.md › Estrutura e implantação; arquitetura.md › Componentes, Tempo real, Autenticação; código: `deploy/compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`, `deploy/web.Dockerfile`, `core/auth/auth_http.go`, `core/auth/login_limit_test.go`, `src/lib/realtime.ts`; `validacao-piloto.md` (Situação, Teste da implantação, Roteiro de implantação).

**Pronto quando:** no Compose, sem token real, `web` não publica porta e `make up` recusa subir sem o token do túnel; dentro da rede do Compose, um login errado com `CF-Connecting-IP` definido grava esse IP em `login_attempts`, e dois valores diferentes contam separados, com o resultado registrado em `validacao-piloto.md`; o roteiro cobre todos os passos acima, com os dois lembretes; há verificação manual explícita, a fazer no servidor na T34: login, cookie `Secure`, WebSocket pelo túnel, envio de arquivo de 16 MB, acesso de casa com código e do escritório sem código, e o comportamento do WebSocket ao expirar a sessão do Access.

**Verificação:** humana

### [x] T42 — Reorganização do menu e ajustes visuais

- **Menu**, em `AppLayout`: grupo Helpdesk (Atendimento, Contatos, Conexão) e grupo Cadastro (Órgãos, Módulos, Setores), com o título fixo de hoje. O grupo Administração deixa de existir, cada item continua visível para os mesmos papéis e os endereços não mudam, como `/admin/usuarios`.
- **Configurações:** ganha "Usuários", só para o administrador, entre o tema e "Sair".
- **Breadcrumb:** Contatos e Conexão passam a Helpdesk; Módulos e Setores, a Cadastro; Usuários, a Configurações. Conexão e Módulos mantêm o nome do setor depois do grupo.
- **Botão de recolher:** no topo da barra, alinhado à direita, mais próximo do conteúdo; recolhida, no centro da coluna de ícones. A altura não muda. O usuário quer ver como fica: registre isso no PR como ponto de revisão visual.
- **Combobox vazio:** a mensagem "Nenhum município encontrado." está apertada na lista do filtro de município, em Contatos. Ajustar o padding em `ComboboxEmpty`, que vale para os outros seletores, sem trocar o texto.

**Ler:** spec.md › Administração; design.md; código: `src/components/AppLayout.tsx`, `src/components/ui/sidebar.tsx`, `src/components/ui/combobox.tsx`, `src/components/MunicipalityPicker.tsx`, `src/pages/admin/UsersPage.tsx`, `src/pages/admin/SectorsPage.tsx`, `src/pages/admin/ModulesPage.tsx`, `src/pages/connection/ConnectionPage.tsx`, `src/pages/directory/ContactsPage.tsx`, `e2e/sidebar.spec.ts`, `e2e/admin.spec.ts`, `e2e/theme.spec.ts`, `e2e/connection.spec.ts`.

**Pronto quando:** atendente vê Atendimento, Contatos e Órgãos; supervisor vê também Conexão e Módulos, sem Setores e Usuários; administrador vê tudo, com Usuários só em Configurações; os grupos e o breadcrumb seguem o `design.md`; o botão de recolher fica à direita com a barra aberta, no centro recolhida, e a altura dele e dos itens não muda; o teste de recolher em `sidebar.spec` reflete a nova regra; o combobox vazio tem respiro nos dois temas, com conferência visual.

### [x] T43 — Assumir chamado pela lista da conversa

- Em `ConversationList`, uma seção "Na fila (N)" no topo, separada do restante e só quando houver chamado na fila, com prévia e botão "Assumir" em cada item. Hoje a fila fica depois dos chamados do usuário, sem botão. O restante da ordem não muda.
- Clicar no item abre a conversa; o botão fica fora do link, porque não pode haver botão dentro dele.
- Ao assumir, a tela não muda e aparece o aviso "Chamado assumido" com o link "Abrir conversa", sem perder o texto em digitação. Se a conversa aberta for a do próprio chamado, ela passa a mostrar o novo responsável.
- Se outra pessoa assumir antes, mostra o erro de concorrência da API em Note, e o item sai da seção. O assumir no painel continua abrindo a conversa.
- A lista segue escondida abaixo de 1280px; a T44 cobre esse caso.

**Ler:** spec.md › Recebimento e distribuição; design.md; código: `src/components/ConversationList.tsx`, `src/lib/tickets.ts`, `src/pages/PanelPage.tsx` (modelo do botão), `src/pages/ticket/TicketPage.tsx`, `e2e/conversation.spec.ts`, `e2e/panel.spec.ts`.

**Pronto quando:** com outra conversa aberta e texto digitado, assumir pela lista não muda a tela nem apaga o texto, e o link abre a conversa assumida; o chamado sai de "Na fila" e aparece como "Você"; com a seção vazia, ela não aparece; dois atendentes disputando o mesmo chamado: um assume e o outro vê o erro; assumir no painel continua abrindo a conversa.

### [x] T44 — Sino de notificações

Depende da T43, porque reaproveita o assumir sem sair da tela.

- Botão do cabeçalho habilitado, abrindo a lista, em todos os papéis e larguras. O componente `Popover` entra sobre `@base-ui/react`, já usado no projeto; nenhuma biblioteca nova.
- **Número desconectado:** a faixa `DisconnectionNote` sai das telas e vira item fixo no topo, para supervisor e administrador, levando a `/conexao?setor=<id>`. Mudança de regra: fica também durante `connecting` e na tela de conexão. Cor de alerta no contador.
- **Chamado na fila:** itens com contato, prévia, "Abrir" e "Assumir", da fila do setor do usuário; administrador consulta todos os setores, com o nome do setor no item. O texto é "Assumir", termo do resto do sistema. Assumir segue a regra da T43, com erro em Note na lista.
- **Aviso ao entrar na fila:** toast breve, sem botão ("Chamado recebido: <contato>"), comparando a fila recarregada com a anterior. Primeira carga e reconexão do WebSocket não avisam.
- Sem tabela nem rota nova: usa `GET` da lista de chamados e os avisos do WebSocket. Atualizar o teste em `sidebar.spec` que espera o botão desabilitado.

**Ler:** spec.md › Estrutura e implantação, Recebimento e distribuição, Notificações; arquitetura.md › Tempo real; design.md; código: `src/components/AppLayout.tsx`, `src/components/DisconnectionNote.tsx`, `src/components/ConversationList.tsx`, `src/lib/realtime.ts`, `src/lib/tickets.ts`, `src/lib/admin.ts`, `src/components/ui/combobox.tsx` (modelo de `@base-ui/react`), `e2e/sidebar.spec.ts`, `e2e/connection.spec.ts`, `e2e/conversation.spec.ts`, `e2e/panel.spec.ts`.

**Pronto quando:** chamado novo sobe o contador, mostra o aviso e o item, sem recarregar; assumir pelo sino não muda a tela; "Abrir" leva à conversa; quando outra pessoa assume ou cancela, o item sai; devolvido à fila volta a aparecer; recarregar a página e reconectar o WebSocket não repetem o aviso; atendente não vê número desconectado, supervisor e administrador veem, com contador em alerta, e o item leva à tela do setor e só sai ao conectar; a faixa não aparece mais; atendente de outro setor não vê o chamado; administrador vê os setores, identificados; funciona na largura do celular.

### [x] T45 — Alertas do navegador e som

Só web. Depende da T44. A verificação manual precisa de HTTPS, então é feita no endereço publicado da T41; o endereço HTTP do Tailscale não libera notificações.

- Em Configurações, uma opção para ativar a notificação do navegador e outra para o som, guardadas no navegador, como o tema. A permissão só é pedida ao ativar, nunca ao abrir a página, e permissão negada mostra o motivo.
- Notificação ao entrar um chamado na fila, só com a aba em segundo plano: nome do contato, sem o texto da mensagem, sem repetir o mesmo chamado entre abas. Clicar traz a aba para a frente e abre a conversa.
- Som curto gerado no navegador, sem arquivo nem biblioteca. Sem interação prévia com a página, o navegador bloqueia e nada quebra.
- Título da aba com o contador do sino, por exemplo `(2) Central de Atendimento`, voltando ao título normal com zero.
- Usa a mesma comparação de fila da T44: primeira carga e reconexão não alertam. Fora do escopo: PWA e Web Push.

**Ler:** spec.md › Notificações; arquitetura.md › Tempo real; design.md; código: `src/components/AppLayout.tsx`, `src/lib/theme.ts` (modelo da escolha no navegador), `src/lib/realtime.ts`, `src/lib/tickets.ts`, `e2e/sidebar.spec.ts`, `e2e/theme.spec.ts`.

**Pronto quando:** com a permissão concedida no Playwright, em `localhost`, aba em segundo plano gera a notificação e aba visível não; recarregar não gera; opção desligada não notifica nem toca; a escolha sobrevive ao recarregar; permissão negada mostra o motivo; o título acompanha o contador; há verificação manual em Chrome, Edge e Firefox, no endereço publicado, de notificação, clique e som.

### [x] T46 — Tamanho do texto e alto contraste

Atende, primeiro, uma pessoa da equipe com baixa visão, que valida a entrega. Decisão do usuário: só estes recursos, sem compromisso de conformidade com a norma brasileira.

- Em Configurações, "Tamanho do texto" (Padrão, Grande e Maior, ou 100%, 115% e 130%) e "Alto contraste", guardados no navegador e aplicados antes de pintar a tela.
- As fontes hoje são fixas em pixels em `src/index.css`, com tamanhos fixos também nos componentes (`text-[..px]`). Passar a responder ao fator, sem o restante da tela quebrar. O corpo continua em 14px no Padrão.
- Alto contraste com tokens próprios, em `src/index.css`, para os temas claro e escuro. Texto com 7:1 ou mais, bordas e foco visíveis. Status continua com a palavra, nunca só com a cor.
- Conferir nas telas de maior densidade: conversa, painel, sino, formulário de encerramento e barra lateral. O zoom do navegador continua funcionando.

**Ler:** spec.md › Acessibilidade; design.md; código: `src/index.css`, `index.html`, `src/lib/theme.ts`, `src/components/AppLayout.tsx`, `e2e/theme.spec.ts`, `e2e/sidebar.spec.ts`.

**Pronto quando:** cada tamanho muda o texto medido no Playwright e sobrevive ao recarregar, sem piscar; alto contraste muda as cores nos temas claro e escuro, e a combinação com o tamanho funciona; o contraste de texto, botão primário, status e foco é medido e fica em 7:1 ou mais para o texto; na largura do celular, em "Maior", não há rolagem horizontal na página; há verificação manual com a pessoa da equipe com baixa visão, registrada no PR.

## Fase 10 — Janelas de formulário

Pedido da issue #63.

### [x] T49 — Trocar os painéis laterais por janelas centrais

Pode rodar antes das T47 e T48, porque não depende delas.

- Trazer o `Dialog` do shadcn para `ui/`, sobre `@base-ui/react/dialog`, a mesma base do `Sheet`; nenhuma biblioteca nova. O `ui/sheet.tsx` fica só para a gaveta da barra lateral no celular.
- Trocar os 15 painéis: os 14 que usam `FormSheet` e o histórico (`HistorySheet`, que usa o `Sheet` direto). Renomear o `FormSheet` para `FormDialog`. Os demais componentes mantêm o nome, para a revisão ficar pequena.
- `FormDialog` ganha uma opção de bloqueio, que tira o X e não fecha com Esc nem com clique fora. Na Base UI 1.9, a documentação indica `disablePointerDismissal` no `Dialog.Root` para o clique fora e `eventDetails.cancel()` em `onOpenChange`, com `reason === 'escape-key'`, para o Esc.
- Com bloqueio: `ClosingSheet` (encerrar e transferir para setor), `TransferSheet`, `ReturnSheet`, `CancelSheet`, `CorrectionSheet`, `NewConversationSheet` e `RegisterContactSheet`, além do `ContactSheet` aberto pela nova conversa.
- Com fechamento normal: `ContactSheet` e `ImportContactsSheet` em Contatos, `HistorySheet` e os formulários de `UsersPage`, `SectorsPage`, `ModulesPage`, `OrganizationsPage` e `ConnectionPage`.
- A janela de encerramento cobre a conversa, como os outros formulários: registre isso no PR como ponto de revisão visual. O painel fixo da conversa (Detalhes, Notas e Histórico) não muda.
- Atualizar os testes que dependem do fechamento: `e2e/start-conversation.spec.ts` hoje fecha o cadastro de contato com Esc e clique fora.

**Ler:** spec.md › Janelas de formulário, Iniciar conversas, Formulário de encerramento, Acessibilidade; arquitetura.md › Bibliotecas padrão; design.md; código: `src/components/FormSheet.tsx`, `src/components/ui/sheet.tsx`, `src/components/ui/sidebar.tsx`, `src/components/TicketHistory.tsx`, `src/components/ContactSheet.tsx`, `src/components/NewConversationSheet.tsx`, `src/components/ClosingSheet.tsx`, `src/pages/ticket/TicketPage.tsx`, `src/pages/directory/ContactsPage.tsx`, `e2e/start-conversation.spec.ts`, `e2e/closing.spec.ts`, `e2e/directory.spec.ts`, `e2e/accessibility.spec.ts`.

**Pronto quando:** cada janela com bloqueio é coberta por teste: sem X, Esc e clique fora não fecham e o texto digitado continua, e Cancelar fecha; cada janela com fechamento normal fecha por X, Esc e clique fora; o mesmo cadastro de contato tem bloqueio no atendimento e na nova conversa e fechamento normal em Contatos; cancelar o cadastro aberto pela nova conversa ou pelo encerramento volta à janela de origem com os dados mantidos, e o Esc nele não fecha nenhuma das duas; seletores (combobox) funcionam dentro da janela; em formulário longo, só o corpo rola e o rodapé fica visível; a barra lateral continua como gaveta no celular; nenhum teste foi desativado; capturas de um formulário curto, um longo e um aninhado, nos temas claro e escuro, no desktop e no celular, com texto "Maior" sem rolagem horizontal, estão no PR para a revisão visual de Thiago antes do merge.

**Verificação:** humana

## Fase 9 — Dashboard do atendimento

Pedido da issue #61.

### [x] T47 — API do dashboard do atendimento

- Assunto novo em `helpdesk`, com o trio `dashboard.go`, `dashboard_http.go` e `dashboard_test.go`, e as queries em `db/queries/dashboard.sql`. Sem migração: tudo é calculado na hora, com os índices atuais.
- `GET /api/dashboard`, com os filtros de período, setor, atendente, módulo e órgão, devolve os nove números e a tabela por atendente, conforme spec.md › Dashboard do atendimento. A resposta distingue "não se aplica ao filtro" de "sem dados", e a tela só mostra o que a API disser.
- Uma rota para as opções do filtro de atendente de um setor: quem é do setor, ativo ou não, e quem já foi responsável por chamado dele. Para o filtro de módulo, a rota `GET /api/sectors/{id}/modules` já atende supervisor e administrador.
- O período é escolhido por nome (hoje, 7 dias, 30 dias) ou por datas. O backend resolve os dias no horário de Brasília, como em `closed_today.go`. Data inválida ou início depois do fim dão 400.
- Permissões no backend: só supervisor e administrador. O supervisor fica sempre no próprio setor, e pedir outro dá 403. Atendente ou módulo de outro setor, ou enviados sem setor, dão 400.
- **Dados conferidos:** `tickets.created_by_id` preenchido indica conversa iniciada no sistema. Chamado criado por mensagem enviada do celular tem `created_by_id` vazio, e a primeira mensagem dele tem `origin = 'phone'`: conta como iniciado, não como recebido, e fica fora da espera. Chamado de transferência entre setores tem `previous_ticket_id` e conta como recebido. Chamado cancelado da fila tem `assigned_at` vazio e fica fora da espera. `assigned_at` guarda só a primeira vez que alguém assumiu.
- Fora do escopo: a tela (T48) e transferência entre atendentes como número.

**Ler:** spec.md › Dashboard do atendimento, Encerramento, retorno e correções, Cancelamento; modelo-dados.md › `tickets`, `ticket_modules`, `messages`, Permissões, Ciclo de vida do chamado; arquitetura.md › Um arquivo por assunto; código: `helpdesk/routes.go`, `helpdesk/closed_today.go`, `helpdesk/closed_today_http.go`, `helpdesk/closed_today_test.go`, `helpdesk/helpers_test.go`, `db/queries/tickets.sql`.

**Pronto quando:** testes de integração cobrem cada número e a data que o põe no período, inclusive a virada do dia em Brasília; cada célula da tabela de filtros da spec, inclusive os casos "não se aplica"; a transferência entre setores contada na origem e no destino; chamado iniciado no sistema e pelo celular fora dos recebidos; espera sem contar a volta à fila e contada no destino da transferência; tempo de atendimento ignorando o "Início" editado, respeitando o "Fim" editado e sem o chamado com "Fim" anterior a ter sido assumido, nem cancelados; correção de órgão e módulos refletida nos números; chamado com dois módulos contado em cada um; tabela por atendente com responsável final, sem linhas zeradas; atendente recebe 403; supervisor vê o próprio setor e recebe 403 em outro; administrador vê um setor ou todos; filtros de outro setor e datas inválidas dão 400.

**Verificação:** humana

### [x] T48 — Tela do dashboard do atendimento

Depende da T47: só comece com ela mergeada.

- Tela em `/dashboard`, para supervisor e administrador, com "Dashboard" no grupo Helpdesk do menu, logo depois de Atendimento. O atendente não vê o item, e o endereço o leva ao painel, como as outras rotas protegidas.
- Filtros no topo, guardados no endereço da página, para sobreviver ao recarregar: período em Chip (`ToggleGroup`, sobre `@base-ui/react`, sem biblioteca nova), com datas à escolha; setor só para o administrador; atendente; módulo; órgão com o `OrganizationPicker`. Atendente e módulo seguem a regra da spec para o administrador sem setor escolhido.
- Nove KpiCards, separando "Agora" (fila e em atendimento) do período. O componente KpiCard ainda não existe no código: criar conforme o `design.md`, sobre `Card`, usando o estilo `kpi-value`. Tempo médio em horas e minutos ("1 h 05 min"; abaixo de um minuto, "menos de 1 min"). "—" com "Não se aplica ao filtro" quando a API indicar.
- Tabela por atendente conforme o `design.md`, com números em mono à direita e EmptyState quando não houver linhas. Coluna de setor só na visão de todos os setores.
- Recarregar os dados com os avisos de chamado do WebSocket e ao reconectar, em `lib/realtime.ts`. Sem gráficos.

**Ler:** spec.md › Dashboard do atendimento, Acessibilidade; arquitetura.md › Tempo real, Bibliotecas padrão; design.md; código: `src/App.tsx`, `src/components/AppLayout.tsx`, `src/components/Topbar.tsx`, `src/components/ui/card.tsx`, `src/components/ui/table.tsx`, `src/components/ContactFilters.tsx` (modelo de filtros), `src/components/ContactSheet.tsx` (`OrganizationPicker`), `src/lib/realtime.ts`, `src/lib/tickets.ts`, `src/pages/PanelPage.tsx` (modelo do setor do administrador), `src/index.css`, `e2e/panel.spec.ts`, `e2e/sidebar.spec.ts`, `e2e/fixtures.ts`.

**Pronto quando:** testes ponta a ponta mostram que o supervisor abre a tela pelo menu, vê só o próprio setor e não tem filtro de setor; o administrador alterna entre todos os setores e um setor; o atendente não vê o item e, pelo endereço, volta ao painel; um chamado novo muda "Na fila" e "Recebidos" sem recarregar; trocar período, atendente, módulo e órgão muda os números; "Na fila" não muda com o período; "Não se aplica ao filtro" aparece nos números indicados pela API; atendente e módulo ficam desabilitados para o administrador sem setor e são limpos ao trocar de setor; os filtros sobrevivem ao recarregar; os itens existentes do menu continuam como estão em `sidebar.spec`; capturas nos temas claro e escuro, no desktop e no celular, sem rolagem horizontal na página, inclusive no texto "Maior", estão no PR.

**Verificação:** automática

## Ideias em avaliação

Levantadas nos testes e na revisão do código, sem decisão por enquanto. Se aprovadas, viram regra em `spec.md` e uma issue com o rótulo `task`.

- **PWA:** depois de validar os alertas da T45 na web, instalar o sistema como aplicativo, com contador no ícone (Badging API, com suporte limitado entre navegadores). Web Push, para avisar com tudo fechado, e aplicativo desktop (Tauri ou MyGo) ficam de fora por agora.
- **Conformidade com a ABNT NBR 17225:** norma brasileira de acessibilidade web, de março de 2025, baseada no WCAG 2.2. A conformidade regular corresponde aos níveis A e AA. A T46 não a cobre: faltaria revisar teclado, formulários e leitores de tela. Vale reavaliar se um cliente exigir, inclusive pelo art. 63 da Lei Brasileira de Inclusão.

- **Órgãos no contrato:** quando houver contratos, o contrato aponta o órgão cliente (por exemplo, a prefeitura) e os outros órgãos que fazem parte dele. A sugestão é uma tabela ligando contrato e órgãos, sem órgão pai no cadastro, porque uma autarquia também pode contratar sozinha.

- **Aviso de mensagem com falha:** hoje dá para encerrar ou transferir com a última resposta em "Falhou" ou ainda enviando, e o cliente fica sem resposta. Os formulários poderiam avisar, sem impedir.
- **Cliente responde pelo número de origem depois da transferência entre setores:** abre um chamado novo na origem. Falta decidir se fica assim e se esse chamado deve mostrar que existe outro aberto no destino.
- **Bloquear ou ignorar um número:** depois de um cancelamento por spam, o mesmo número abre outro chamado a cada mensagem.
- **Funções longas do backend:** `Correct`, `Start`, `record`, `Send` e `Corrections` podem ser quebradas quando uma task já estiver mexendo nelas, com os testes de apoio, mantendo visível a ordem das travas.
- **Glossário:** ligar os termos do código aos da spec (chamado = `ticket`, responsável = `assignee`, `accessible` = pode agir, `viewable` = pode ler).
- **Idioma dos comentários:** os do backend estão em inglês e os do frontend em português, e o `CLAUDE.md` não define a regra.
- **Salvar no celular o contato cadastrado no sistema:** a biblioteca não tem função pronta (existe o campo `SaveOnPrimaryAddressbook`), um envio malformado pode dessincronizar os dados do número, e não se confirmou se a API oficial tem equivalente. Só avaliar depois de um teste com número de teste.
