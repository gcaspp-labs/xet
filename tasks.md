# Tasks — Piloto (Contabilidade)

Fluxo de implementação do piloto. As regras de negócio estão em [spec.md](spec.md), as decisões técnicas em [arquitetura.md](arquitetura.md), o modelo de dados em [modelo-dados.md](modelo-dados.md) e as regras de implementação em [CLAUDE.md](CLAUDE.md).

## Como usar

- As tasks são executadas uma por vez, na ordem, cada uma em sua própria branch (`task/NN-nome-curto`).
- Uma task só é considerada pronta quando todos os itens de "Pronto quando" estiverem atendidos, os testes passarem e a revisão for aprovada.
- Status: `[ ]` pendente, `[~]` em andamento, `[x]` concluída.
- Se durante uma task surgir uma decisão não prevista na spec, ela é registrada na spec antes de seguir.
- O número identifica a task. As tasks pendentes são numeradas na ordem de execução, então basta chamar a próxima. Task nova entra com o próximo número; se precisar vir antes de outras pendentes, as seguintes são renumeradas. As concluídas mantêm o número, porque commits e PRs o citam.

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

Levantados nos primeiros testes com o número real.

### [ ] T20 — Fluxo do painel e realizados hoje

- "Assumir" no painel abre a conversa; a linha inteira do chamado também abre, com link esticado sobre a linha, sem perder o teclado, e o botão "Assumir" continua clicável.
- Encerrar e transferir para outro setor voltam ao painel. A correção continua na mesma tela.
- Consulta e rota dos atendimentos encerrados no dia, por setor, e card "Realizados hoje" no painel. O dia usa `protocolZone` (`internal/ticket/inbound.go`) e `closed_at`, com novo índice, e a lista é atualizada pelos avisos em tempo real do painel.
- Ajustar os e2e `panel`, `closing` e `transfer-sector`, que conferem a tela logo depois de assumir ou encerrar.

**Pronto quando:** assumir leva ao chat; ao encerrar, a pessoa volta ao painel e o atendimento aparece nos realizados, com "Você" nos próprios e os transferidos identificados; outro setor não vê; encerrados de ontem não aparecem.

### [ ] T21 — Cancelar atendimento

- Duas migrações: novo valor `cancelled` em `closure_type` numa e, na seguinte, as restrições `tickets_closed_fields` e `audit_logs_correction_reason`. O Postgres não permite usar um valor de enum na mesma transação em que ele é criado.
- `POST /api/tickets/{id}/cancel` com motivo, travando o chamado como `closeLocked` (`internal/ticket/close.go`). Vindo da fila, grava quem cancelou como responsável, porque `tickets_assigned` exige responsável em chamado encerrado.
- Botão na tela do chamado, com formulário de motivo e volta ao painel. A conversa mostra quem cancelou e o motivo; histórico e realizados mostram "Cancelado".
- A correção recusa chamado cancelado.

**Pronto quando:** fila e atendimento seguem as permissões, com teste de atendente que não é o responsável; motivo em branco é recusado; contato não cadastrado cancela sem órgão; cancelar não cruza com assumir nem com mensagem nova, e a mensagem seguinte abre outro chamado; a correção é recusada; a auditoria grava o motivo na mesma transação.

### [ ] T22 — Devolver à fila

- Ação na tela do chamado em atendimento, com volta ao painel, travando o chamado como em `Transfer` (`internal/ticket/transfer.go`); auditoria `ticket_returned` com `recordTicket` e registro na conversa.

**Pronto quando:** responsável, supervisor e administrador devolvem, e outro atendente não; chamado na fila ou encerrado é recusado; o chamado volta à fila e outra pessoa assume; `assigned_at` se mantém.

### [ ] T23 — Arquivo recebido que não baixa

- Novo tipo `media_unavailable` em `message_type`, com aviso na conversa e na última mensagem do painel.
- No adaptador Whatsmeow, conferir o tamanho informado antes de baixar (limite de 100 MB) e tentar o download algumas vezes. Hoje a falha devolve erro, e a mensagem não entra no chamado enquanto o download falhar (`internal/messaging/whatsmeow/messages.go`).

**Pronto quando:** pelo adaptador falso, a mensagem com arquivo indisponível vira aviso no chamado e a reentrega não duplica; há verificação manual com o número real, enviando um arquivo acima do limite.

### [ ] T24 — Usuário com chamados em atendimento

- `UpdateUser` (`internal/auth/auth.go`) recusa a desativação e a troca de setor, inclusive ao virar administrador, se houver chamados em atendimento, informando a quantidade. A tela de usuários mostra a mensagem.

**Pronto quando:** desativar e trocar de setor são recusados com chamados e passam depois de transferir; editar o nome ou o e-mail continua livre.

### [ ] T25 — Telefone do setor pelo QR code

- Migração: `sectors.phone` opcional e nova coluna `connection_error`. O telefone sai do formulário e da API de setores.
- O evento de conexão passa a informar o telefone da conta (no Whatsmeow, de `Store.ID`). `HandleConnection` (`internal/sector/connection.go`) grava o telefone e o apaga em `logged_out`.
- Número já ligado a outro setor (`sectors_phone_key`): grava o motivo e desvincula o aparelho fora da transação e fora do tratamento do evento. A tela de conexão mostra o motivo.
- Informar um tipo de plataforma conhecido em `store.DeviceProps` (`internal/messaging/whatsmeow/whatsmeow.go`): com o tipo desconhecido, o celular mostra "Outro dispositivo" em vez de "Central de Atendimento". Essas informações só são enviadas no pareamento, então um número já conectado precisa ler o QR code de novo.
- Botão "Desvincular número" na tela de conexão, com confirmação, e `DELETE /api/sectors/{id}/connection`, para supervisor do setor e administrador. Usa o `Disconnect` que o contrato de mensageria já tem e que hoje nenhuma rota chama, depois de gravar o estado com o autor (ver `arquitetura.md`), porque o evento emitido pelo adaptador não tem autor.
- As telas mostram "Não conectado" sem telefone. Ajustar `seedSector` (`frontend/e2e/fixtures.ts`) e os testes de setor e de conexão.

**Pronto quando:** conectar preenche o telefone; número de outro setor é recusado com o motivo na tela, sem erro 500; uma queda temporária mantém o telefone e desvincular o apaga; há verificação manual com o número real, em que o celular deixa de mostrar "Outro dispositivo"; supervisor e administrador desvinculam, atendente e supervisor de outro setor não; desvincular grava a auditoria com o autor, repetir não gera novo registro e o setor volta a conectar pelo QR code.

### [ ] T26 — Setores e módulos do contato

- Migração das tabelas `contact_sectors` e `contact_modules`, preenchendo os setores a partir dos chamados existentes.
- Setores (ao menos um) e módulos opcionais no cadastro do contato (`ContactSheet`). Rota de leitura dos módulos ativos para todos os papéis, porque a atual é restrita à supervisão.
- Filtros de setor e módulo na busca de contatos: "Meu setor" por padrão, com opção de todos; "Nova conversa" usa o mesmo filtro.
- Vínculo automático na transação do recebimento, da nova conversa e da transferência entre setores.
- `closing-form` devolve os módulos do contato entre os ativos do setor, e o `ClosingSheet` os marca.

**Pronto quando:** o filtro "Meu setor" funciona e o administrador abre em todos; mensagem, nova conversa e transferência criam o vínculo sem duplicar; módulo fora dos setores do contato é recusado; os módulos vêm marcados no encerramento e podem ser alterados.

### [ ] T27 — Cadastrar contato em "Nova conversa"

- Botão em `NewConversationSheet` que abre o `ContactSheet` por cima, como o `ClosingSheet` já faz. O `ContactSheet` passa a devolver o contato salvo, que fica escolhido para a primeira mensagem.

**Pronto quando:** dá para cadastrar um contato e enviar a primeira mensagem sem sair da tela; telefone já cadastrado mostra o aviso sem fechar a conversa.

### [ ] T28 — Importar contatos do WhatsApp

- Interface opcional `ContactBook`, no padrão de `QRPairing` (`internal/messaging/messaging.go`), no adaptador Whatsmeow (`Store.Contacts.GetAllContacts`, com telefone resolvido quando o contato vem por LID) e no falso. Só entram contatos com nome salvo e telefone.
- Levar `phoneVariants` (`internal/ticket/inbound.go`) para `internal/directory`, para usar a mesma regra do nono dígito.
- Botão "Importar contatos" na tela de contatos: lista com seleção e "selecionar todos", órgão opcional para o lote e resumo do resultado. O cliente envia só os telefones escolhidos; os nomes são lidos de novo no servidor.
- Importação numa única transação, com auditoria `contacts_imported`. Avisar quando o número estiver desconectado ou o provedor não tiver agenda.

**Pronto quando:** importa selecionados e todos, com e sem órgão; repetir a importação e a variante do nono dígito não duplicam nem sobrescrevem, só vinculam o setor; atendente não importa de outro setor; há verificação manual com o número real.

### [ ] T29 — Menu de configurações e tema

- Botão "Configurações" no rodapé da barra lateral (`AppLayout`), com "Sair" e tema Claro, Escuro ou Sistema. Adicionar o `DropdownMenu` do shadcn, sem biblioteca nova.
- Escolha guardada no `localStorage` e aplicada antes de pintar a tela; `color-scheme` no CSS e `sonner` acompanhando o tema (hoje fixo em `system`).
- Ajustar o e2e `auth`, que clica em "Sair".

**Pronto quando:** o tema persiste ao recarregar e vale também na tela de login; "Sistema" segue o sistema operacional; "Sair" funciona pelo menu; o menu funciona por teclado.

### [ ] T30 — Player de áudio próprio

- Componente sobre `<audio>` sem controles nativos, com tocar e pausar, progresso e tempo, usado na gravação (`Composer`) e nas mensagens (`MessageMedia`, em `TicketPage`). A duração aparece uma única vez.

**Pronto quando:** o áudio toca e avança na gravação e nas mensagens, nos dois temas; a barra funciona por teclado; o botão de enviar continua visível em tela estreita.

## Fase 5 — Pós-MVP

Ajustes para fazer antes de escalar para outros setores, levantados durante o piloto.

### [ ] T31 — Reforço da autenticação

- Limitar tentativas de login por e-mail e por IP, com bloqueio temporário após falhas seguidas, contra força bruta.
- Recusar senhas comuns ou vazadas (lista de senhas conhecidas), como recomenda o NIST SP 800-63B-4.
- Limpar periodicamente as sessões expiradas, inclusive de usuários que não voltam a fazer login.
- Autenticação em dois fatores, recomendada pelo guia de segurança da ANPD para agentes de pequeno porte (item 44).

**Pronto quando:** login bloqueia após o limite de tentativas; senha comum é recusada; sessões expiradas são removidas sem depender de novo login; usuário consegue ativar e usar o segundo fator; testes cobrem cada regra.

## Fase 6 — Validação do piloto

### [ ] T32 — Implantação e validação

Pode rodar antes das anteriores, quando houver acesso ao servidor. Como a skill `/implementar-task` para ao encontrar task anterior pendente, é só confirmar para ela seguir.

- Implantação no servidor da empresa com Docker Compose e HTTPS.
- Percorrer todos os critérios de validação da spec com o número real da Contabilidade.
- Testes ponta a ponta (Playwright) dos fluxos principais.
- Teste de reconexão: queda de internet, reinício do servidor, desconexão do celular.

**Pronto quando:** todos os critérios de validação da spec estão marcados como atendidos.

## Configurações pendentes

Ajustes fora do código, feitos no GitHub por quem administra o repositório.

### [ ] T33 — Proteção da branch main

- Exigir PR para alterar a `main` (sem push direto).
- Exigir os checks do CI (T18) verdes e a branch atualizada antes do merge.

**Pronto quando:** um PR com check falhando não pode ser mergeado e push direto na `main` é recusado.

## Ideias em avaliação

Levantadas nos testes e na revisão do código, sem decisão por enquanto. Se aprovadas, viram regra em `spec.md` e task nesta lista.

- **Aviso de mensagem com falha:** hoje dá para encerrar ou transferir com a última resposta em "Falhou" ou ainda enviando, e o cliente fica sem resposta. Os formulários poderiam avisar, sem impedir.
- **Cliente responde pelo número de origem depois da transferência entre setores:** abre um chamado novo na origem. Falta decidir se fica assim e se esse chamado deve mostrar que existe outro aberto no destino.
- **Bloquear ou ignorar um número:** depois de um cancelamento por spam, o mesmo número abre outro chamado a cada mensagem.
- **Salvar no celular o contato cadastrado no sistema:** a biblioteca não tem função pronta (existe o campo `SaveOnPrimaryAddressbook`), um envio malformado pode dessincronizar os dados do número, e não se confirmou se a API oficial tem equivalente. Só avaliar depois de um teste com número de teste.
