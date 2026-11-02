# Tasks — Piloto (Contabilidade)

Fluxo de implementação do piloto. As regras de negócio estão em [spec.md](spec.md), as decisões técnicas em [arquitetura.md](arquitetura.md), o modelo de dados em [modelo-dados.md](modelo-dados.md) e as regras de implementação em [CLAUDE.md](CLAUDE.md).

## Como usar

- As tasks são executadas uma por vez, na ordem, cada uma em sua própria branch (`task/NN-nome-curto`).
- Uma task só é considerada pronta quando todos os itens de "Pronto quando" estiverem atendidos, os testes passarem e a revisão for aprovada.
- Status: `[ ]` pendente, `[~]` em andamento, `[x]` concluída.
- Se durante uma task surgir uma decisão não prevista na spec, ela é registrada na spec antes de seguir.
- O número identifica a task. As tasks pendentes são numeradas na ordem de execução, então basta chamar a próxima. Task nova entra com o próximo número; se precisar vir antes de outras pendentes, as seguintes são renumeradas. As concluídas mantêm o número, porque commits e PRs o citam. Um ajuste pequeno de processo pode entrar com sufixo (T20.1), sem renumerar as seguintes.
- A linha `**Ler:**` de cada task aponta as seções dos documentos e os arquivos de partida, para não ler tudo a cada task (passo 2 da skill `/implementar-task`). Os caminhos partem de `backend/internal/`, de `backend/` (em `db/`), de `frontend/` (em `src/`, `e2e/` e `index.html`) e da raiz (em `deploy/` e `.github/`).

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

Ajuste de processo, sem mudança no produto. A skill `/implementar-task` lia seis documentos inteiros a cada task e passa a ler só o que a task precisa, sem esquecer regra de negócio.

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
- Atualizar `arquitetura.md` (Estrutura do repositório e "Um arquivo por assunto") e `modelo-dados.md` (Domínios e dependências) antes de mover o código, e depois os caminhos da skill `/implementar-task` (passo 2) e das linhas `**Ler:**` das tasks pendentes.
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

## Fase 6 — Validação do piloto

### [~] T34 — Implantação e validação

Pode rodar antes das anteriores, quando houver acesso ao servidor. Como a skill `/implementar-task` para ao encontrar task anterior pendente, é só confirmar para ela seguir.

- Implantação no servidor da empresa com Docker Compose e HTTPS.
- Percorrer todos os critérios de validação da spec com o número real da Contabilidade.
- Testes ponta a ponta (Playwright) dos fluxos principais.
- Teste de reconexão: queda de internet, reinício do servidor, desconexão do celular.

**Ler:** spec.md › Estrutura e implantação, Critérios de validação do piloto; arquitetura.md › Componentes, Conexão do número; código: `deploy/compose.yml`, `deploy/Caddyfile`, `deploy/web.Dockerfile`, `e2e/`.

**Pronto quando:** todos os critérios de validação da spec estão marcados como atendidos.

**Situação:** a parte que não depende do servidor está feita (cobertura dos critérios, teste do Compose com HTTPS local, roteiros). Falta implantar e percorrer os critérios pendentes com o número real, em `validacao-piloto.md`.

## Configurações pendentes

Ajustes fora do código, feitos no GitHub por quem administra o repositório.

### [ ] T35 — Proteção da branch main

- Exigir PR para alterar a `main` (sem push direto).
- Exigir os checks do CI (T18) verdes e a branch atualizada antes do merge.

**Ler:** arquitetura.md › Integração contínua; código: `.github/workflows/ci.yml`.

**Pronto quando:** um PR com check falhando não pode ser mergeado e push direto na `main` é recusado.

## Dependem da implantação

Ficam para depois de escolher onde o sistema será implantado.

### [ ] T36 — Autenticação em dois fatores

Separada da T33 porque o envio de e-mail depende do local de implantação, ainda não escolhido. Antes de implementar, definir na spec o meio do segundo fator: código por e-mail ou aplicativo autenticador (TOTP), que não usa e-mail.

- Autenticação em dois fatores, recomendada pelo guia de segurança da ANPD para agentes de pequeno porte (item 44).
- O limite de tentativas da T33 vale também para o código do segundo fator.

**Ler:** spec.md › Usuários e acesso; modelo-dados.md › `users`, `sessions`, `login_attempts`, `audit_logs`; arquitetura.md › Autenticação; design.md; código: `core/auth/auth.go`, `core/auth/auth_http.go`, `core/auth/auth_test.go`, `src/pages/LoginPage.tsx`, `src/lib/auth.ts`, `e2e/auth.spec.ts`.

**Pronto quando:** usuário consegue ativar e usar o segundo fator; testes cobrem cada regra.

## Fase 7 — Órgãos, municípios e contatos

Levantadas nos testes da interface. Podem rodar antes das pendentes acima: como a skill `/implementar-task` para ao encontrar task anterior pendente, é só confirmar para ela seguir.

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

### [ ] T38 — Filtro por município e órgão nos contatos

- Filtros de município e de órgão em `ContactFilters`, valendo em "Nova conversa" e na lista de contatos. O de município mostra só os que têm órgão cadastrado; o de órgão acompanha o município escolhido.
- `SearchContacts` passa a aceitar os dois filtros e a buscar pelo nome do município, com índice próprio se necessário.
- Filtro com valor inválido responde 422, como os de setor e módulo.

**Ler:** spec.md › Órgãos e contatos, Iniciar conversas; modelo-dados.md › `organizations`, `contacts`; design.md; código: `core/directory/directory.go`, `core/directory/directory_http.go`, `db/queries/contacts.sql`, `core/directory/directory_test.go`, `src/components/ContactFilters.tsx`, `src/components/NewConversationSheet.tsx`, `src/pages/directory/ContactsPage.tsx`, `src/lib/directory.ts`, `e2e/directory.spec.ts`, `e2e/start-conversation.spec.ts`.

**Pronto quando:** nas duas telas, escolher município ou órgão mostra só os contatos correspondentes, combinando com setor, módulo e texto digitado; a lista de órgãos acompanha o município; buscar o município, com ou sem acento, encontra os contatos dos órgãos dele.

### [ ] T39 — Cadastrar o contato durante o atendimento

- Aviso no topo da conversa e botão junto do contato no painel lateral, só em chamado aberto com contato não cadastrado, abrindo o `ContactSheet`.
- Nesse caminho, o órgão é opcional. Sem órgão, uma rota própria grava só o nome e mantém `registered = false`; o formulário deixa claro que os demais dados não são salvos. Com órgão, vale o cadastro completo que já existe.
- A rota do nome recusa contato já cadastrado com resposta clara e, como a edição de contato hoje, não grava auditoria.
- Conferir se o nome novo chega às outras telas abertas, com evento publicado depois do commit. O encerramento e a transferência continuam exigindo o cadastro completo.

**Ler:** spec.md › Órgãos e contatos, Formulário de encerramento; modelo-dados.md › `contacts`, Permissões, `audit_logs`; design.md; código: `src/pages/ticket/TicketPage.tsx`, `src/components/ContactSheet.tsx`, `src/components/ClosingSheet.tsx` (modelo), `core/directory/directory.go`, `core/directory/directory_http.go`, `db/queries/contacts.sql`, `helpdesk/inbound.go`, `core/directory/directory_test.go`, `e2e/directory.spec.ts`, `e2e/closing.spec.ts`.

**Pronto quando:** dá para salvar só o nome, sem encerrar e sem assumir, e ele aparece na conversa, no painel e na lista de contatos; nova mensagem recebida não troca o nome salvo; só com o nome, o aviso continua e o encerramento pede o órgão; o cadastro completo tira o aviso, e o chamado aberto recebe o órgão, com auditoria; contato já cadastrado e chamado encerrado não mostram o aviso.

### [ ] T40 — Consulta de CNPJ no cadastro de órgão

Antes de implementar, escolher a API e registrar a justificativa em `arquitetura.md`, avaliando limites, custos, dados devolvidos e suporte ao CNPJ alfanumérico. Opções a avaliar: BrasilAPI, ReceitaWS e CNPJá. Se ela devolver o código IBGE, avaliar guardá-lo em `municipalities` para achar o município sem depender da grafia.

- Botão de consulta no formulário de órgão, para supervisores e administradores, com a chamada saindo do backend, fora de qualquer transação.
- Sugere nome e município, sem salvar nada; município não encontrado fica para escolher à mão. Nenhum dado extra é guardado por enquanto.
- Falha ou CNPJ não encontrado mostram aviso e mantêm o cadastro manual.

**Ler:** spec.md › Órgãos e contatos; modelo-dados.md › `municipalities`, `organizations`, Permissões; arquitetura.md › Bibliotecas padrão; design.md; código: `core/directory/directory.go`, `core/directory/directory_http.go`, `core/directory/directory_test.go`, `src/pages/directory/OrganizationsPage.tsx`, `src/lib/directory.ts`, `e2e/directory.spec.ts`.

**Pronto quando:** com um servidor falso no lugar da API, sem chamar o serviço real, a consulta sugere os dados e nada é salvo sem confirmação; CNPJ não encontrado e API fora do ar não impedem o cadastro manual; atendente não consulta; há verificação manual com a API real.

## Ideias em avaliação

Levantadas nos testes e na revisão do código, sem decisão por enquanto. Se aprovadas, viram regra em `spec.md` e task nesta lista.

- **Órgãos no contrato:** quando houver contratos, o contrato aponta o órgão cliente (por exemplo, a prefeitura) e os outros órgãos que fazem parte dele. A sugestão é uma tabela ligando contrato e órgãos, sem órgão pai no cadastro, porque uma autarquia também pode contratar sozinha.

- **Aviso de mensagem com falha:** hoje dá para encerrar ou transferir com a última resposta em "Falhou" ou ainda enviando, e o cliente fica sem resposta. Os formulários poderiam avisar, sem impedir.
- **Cliente responde pelo número de origem depois da transferência entre setores:** abre um chamado novo na origem. Falta decidir se fica assim e se esse chamado deve mostrar que existe outro aberto no destino.
- **Bloquear ou ignorar um número:** depois de um cancelamento por spam, o mesmo número abre outro chamado a cada mensagem.
- **Funções longas do backend:** `Correct`, `Start`, `record`, `Send` e `Corrections` podem ser quebradas quando uma task já estiver mexendo nelas, com os testes de apoio, mantendo visível a ordem das travas.
- **Glossário:** ligar os termos do código aos da spec (chamado = `ticket`, responsável = `assignee`, `accessible` = pode agir, `viewable` = pode ler).
- **Idioma dos comentários:** os do backend estão em inglês e os do frontend em português, e o `CLAUDE.md` não define a regra.
- **Salvar no celular o contato cadastrado no sistema:** a biblioteca não tem função pronta (existe o campo `SaveOnPrimaryAddressbook`), um envio malformado pode dessincronizar os dados do número, e não se confirmou se a API oficial tem equivalente. Só avaliar depois de um teste com número de teste.
