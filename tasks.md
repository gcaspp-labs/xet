# Tasks — Piloto (Contabilidade)

Fluxo de implementação do piloto. As regras de negócio estão em [spec.md](spec.md), as decisões técnicas em [arquitetura.md](arquitetura.md), o modelo de dados em [modelo-dados.md](modelo-dados.md) e as regras de implementação em [CLAUDE.md](CLAUDE.md).

## Como usar

- As tasks são executadas uma por vez, na ordem, cada uma em sua própria branch (`task/NN-nome-curto`).
- Uma task só é considerada pronta quando todos os itens de "Pronto quando" estiverem atendidos, os testes passarem e a revisão for aprovada.
- Status: `[ ]` pendente, `[~]` em andamento, `[x]` concluída.
- Se durante uma task surgir uma decisão não prevista na spec, ela é registrada na spec antes de seguir.
- O número identifica a task; a ordem de execução é a ordem desta lista. Tasks incluídas depois recebem o próximo número livre e entram na posição em que devem ser feitas.

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

### [ ] T12 — Transferência entre atendentes

- Transferir responsabilidade preservando histórico; registrar na auditoria.

**Pronto quando:** novo responsável responde, o anterior não; a transferência aparece no histórico.

### [ ] T13 — Encerramento

- Formulário com assunto, resolução e módulos obrigatórios; cliente, atendente e setor automáticos; início e fim editáveis.
- Troca de órgão no encerramento, apenas para o chamado.
- Exigir vínculo cadastral para número desconhecido.
- Alterações de horário registradas na auditoria.
- Mensagem após o encerramento cria novo chamado.

**Pronto quando:** chamado só encerra com os dados completos; testes cobrem obrigatoriedade, vínculo e novo chamado após encerramento.

### [ ] T14 — Correções com auditoria

- Corrigir atendimento encerrado com motivo, restrito a quem encerrou e aos supervisores.
- Auditoria com autor, data, motivo e valores anteriores e novos.

**Pronto quando:** correção sem motivo é recusada; atendente que não encerrou é bloqueado; a auditoria mostra a alteração.

### [ ] T15 — Transferência entre setores

- Preencher o formulário de encerramento completo na origem, encerrar a etapa e criar chamado vinculado na fila do destino.
- Destino vê o histórico relacionado e envia a primeira mensagem (texto livre) ao assumir.

**Pronto quando:** cenário validado com um segundo número de teste.

## Fase 4 — Validação do piloto

### [ ] T16 — Implantação e validação

- Implantação no servidor da empresa com Docker Compose e HTTPS.
- Percorrer todos os critérios de validação da spec com o número real da Contabilidade.
- Testes ponta a ponta (Playwright) dos fluxos principais.
- Teste de reconexão: queda de internet, reinício do servidor, desconexão do celular.

**Pronto quando:** todos os critérios de validação da spec estão marcados como atendidos.

## Fase 5 — Pós-MVP

Ajustes para fazer antes de escalar para outros setores, levantados durante o piloto.

### [ ] T17 — Reforço da autenticação

- Limitar tentativas de login por e-mail e por IP, com bloqueio temporário após falhas seguidas, contra força bruta.
- Recusar senhas comuns ou vazadas (lista de senhas conhecidas), como recomenda o NIST SP 800-63B-4.
- Limpar periodicamente as sessões expiradas, inclusive de usuários que não voltam a fazer login.
- Autenticação em dois fatores, recomendada pelo guia de segurança da ANPD para agentes de pequeno porte (item 44).

**Pronto quando:** login bloqueia após o limite de tentativas; senha comum é recusada; sessões expiradas são removidas sem depender de novo login; usuário consegue ativar e usar o segundo fator; testes cobrem cada regra.

## Configurações pendentes

Ajustes fora do código, feitos no GitHub por quem administra o repositório.

### [ ] T19 — Proteção da branch main

- Exigir PR para alterar a `main` (sem push direto).
- Exigir os checks do CI (T18) verdes e a branch atualizada antes do merge.

**Pronto quando:** um PR com check falhando não pode ser mergeado e push direto na `main` é recusado.
