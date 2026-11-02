# Arquitetura técnica — Central de atendimento via WhatsApp

Decisões técnicas do piloto. As regras de negócio estão em [spec.md](spec.md).

## Componentes

| Componente | Tecnologia | Papel |
| --- | --- | --- |
| Backend | Go, serviço único | API HTTP, regras de atendimento, autenticação, WebSocket e conexão com o WhatsApp |
| Conexão WhatsApp | Whatsmeow, módulo isolado no backend | Uma sessão por setor; traduz eventos do WhatsApp para eventos internos |
| Interface | React + TypeScript (SPA) | Painel dos atendentes, supervisores e administradores |
| Banco de dados | PostgreSQL | Dados do atendimento, auditoria e sessões do Whatsmeow |
| Arquivos | Disco local (volume) | Anexos, áudios, imagens e vídeos |
| Proxy | Caddy | HTTPS e entrega da interface |
| Implantação | Docker Compose | Mesmo arquivo para servidor local ou VPS |

## Princípios

- **Adaptadores só onde há troca prevista:** a mensageria (Whatsmeow → API oficial) e o armazenamento de arquivos (disco → S3 ou similar). O restante do sistema usa as bibliotecas diretamente, sem camadas de abstração extras.
- **Armazenamento de arquivos substituível:** anexos são gravados por uma interface de armazenamento; no piloto, disco local. Pode passar para armazenamento de objetos (S3 ou similar) numa migração para VPS.
- **Mensagens idempotentes:** cada mensagem é gravada com o identificador externo do provedor, evitando duplicidade em reconexões.
- **Mídia baixada na chegada:** anexos recebidos são baixados e salvos imediatamente, pois os links do WhatsApp expiram.
- **Disco local no piloto:** a interface de armazenamento fica em `internal/core/storage`, com a implementação em disco sob o diretório `STORAGE_DIR` (padrão `data/media`, relativo ao diretório do backend; no Docker Compose, o volume `media-data` em `/data/media`). Cada arquivo recebe uma chave aleatória organizada por ano e mês (`2026/10/<hex>`).

## Adaptador de mensageria

A migração futura para a API oficial do WhatsApp (Cloud API) deve consistir em escrever um novo adaptador, sem alterar regras de atendimento nem dados.

### Contrato

O pacote `internal/helpdesk/messaging` define a interface e os tipos neutros; cada provedor fica em um subpacote (`internal/helpdesk/messaging/whatsmeow`, futuramente `internal/helpdesk/messaging/cloudapi`).

- **Envio:** `SendText`, `SendMedia` (imagem, vídeo, áudio, documento) com destinatário, conteúdo e identificador de idempotência; retorna o identificador externo da mensagem.
- **Eventos recebidos:** mensagem recebida, mensagem enviada por fora do sistema, atualização de status (enviada, entregue, lida, falhou), mudança de conexão. O adaptador entrega eventos já traduzidos para os tipos neutros; o domínio nunca vê tipos do provedor.
- **Mídia:** o adaptador baixa a mídia e entrega o conteúdo; o domínio grava pelo adaptador de armazenamento. Acima do limite de recebimento (100 MB), ou se o download falhar depois de algumas tentativas, o adaptador entrega a mensagem sem o conteúdo (`media_unavailable`), sem baixar o arquivo.
- **Conexão:** iniciar, encerrar e consultar status por setor. O pareamento por QR code é específico do Whatsmeow e fica fora do contrato comum, exposto apenas pelo adaptador Whatsmeow (interface opcional `QRPairing`). O evento de conexão informa o telefone da conta vinculada.
- **Contato:** resolver telefone em identificador externo do contato.
- **Agenda:** a leitura dos contatos salvos no número é uma interface opcional (`ContactBook`), no mesmo padrão de `QRPairing`, porque a API oficial pode não oferecer a agenda. Sem ela, a importação de contatos fica indisponível para o setor.

### Conexão do número

- Ao iniciar, o serviço reconecta cada setor ativo que tem conta vinculada (`external_account_id`); as chaves ficam nas tabelas do `sqlstore` do Whatsmeow.
- Conectar um setor sem conta vinculada inicia o pareamento: a API devolve o QR code como imagem PNG, gerada no backend, e a tela mostra a imagem. O código do QR muda a cada 20 segundos (o primeiro dura 60); depois de cerca de 2 minutos sem leitura, o pareamento expira e o setor volta a desconectado.
- O adaptador traduz os estados de conexão em eventos `ConnectionChanged`; o domínio grava o estado no setor. Desvinculado pelo celular (`logged_out`), o setor perde a conta vinculada e só volta por novo QR code.
- Desvincular pela tela de conexão grava primeiro, numa transação, o setor como `logged_out`, sem conta e sem telefone, com auditoria `sector_disconnected` e o autor da ação. Depois do commit, fora da transação, chama `Disconnect` do adaptador. O `ConnectionChanged` que o adaptador emite não gera novo registro, porque o estado já é o mesmo. Se o aparelho não puder ser avisado, a tela pede para removê-lo também pelo celular.
- A tela de conexão e o alerta de desconexão acompanham o estado pelo WebSocket (ver Tempo real). Cada novo código do QR é informado pelo adaptador como um novo `ConnectionChanged` com `connecting`, sem mudança de estado nem auditoria, para a tela trocar a imagem sozinha; o botão de atualizar fica só como recurso extra.

### Adaptador falso

- `internal/helpdesk/messaging/fake` implementa o contrato para os testes de integração do backend.
- Com `MESSAGING_PROVIDER=fake`, o servidor usa o adaptador falso no lugar do Whatsmeow. Esse modo existe para os testes ponta a ponta, que rodam contra o backend real: só nele existem as rotas `/api/test/messaging/...`, que simulam a leitura e a troca do QR code, a desconexão do número, mensagens recebidas (texto, imagem, vídeo, áudio, documento e arquivo indisponível), confirmações de entrega e leitura das mensagens enviadas e a agenda do número. O padrão é `whatsmeow`, e em produção essas rotas não existem.

### Regras

- Nada fora de `internal/helpdesk/messaging/<provedor>` importa bibliotecas do provedor.
- Os identificadores no banco são neutros (`external_*`) e o setor registra seu provedor (`provider`), permitindo migrar um setor por vez.
- Os testes de integração usam um adaptador falso que implementa o mesmo contrato.

### Diferenças da API oficial a considerar na migração

- Recebimento por webhook HTTP em vez de conexão persistente; exige endereço público com HTTPS.
- Fora da janela de 24 horas desde a última mensagem do cliente, só é possível enviar modelos (templates) aprovados pela Meta. Isso afeta iniciar conversas e a primeira mensagem em transferências entre setores, que hoje são texto livre.
- Cobrança por conversa ou mensagem, conforme a tabela da Meta.
- Não há QR code; o número é registrado na plataforma da Meta.

## Regras críticas no banco

- **Assumir chamado:** atualização condicional (só assume se ainda não tiver responsável), garantindo que apenas um atendente vença quando houver cliques simultâneos.
- **Um chamado aberto por contato e setor:** índice único parcial no banco, impedindo chamados abertos duplicados.
- **Responder:** o backend verifica o responsável a cada envio; a interface apenas reflete a regra.
- **Auditoria:** transferências, alterações de horários, correções (com motivo) e trocas de órgão gravadas em tabela própria, com autor, data, valores anteriores e novos.

## Modelo de dados

Entidades, ligações, restrições e permissões estão em [modelo-dados.md](modelo-dados.md).

## Tempo real

- O painel recebe novas mensagens, mudanças de fila, responsáveis e status da conexão por WebSocket, filtrados pelo setor do usuário (todos, para o administrador).
- Um único endpoint, `GET /api/ws`, autenticado pelo cookie de sessão. O servidor mantém em memória apenas as conexões abertas (pacote `internal/core/realtime`), protegidas por mutex; cada conexão guarda o usuário e só recebe eventos dos setores a que ele tem acesso.
- Os eventos são avisos, não dados: `{"type": "ticket", "sectorId": 1, "ticketId": 10}` quando um chamado é criado, recebe ou envia mensagem, muda a situação de entrega de uma mensagem, ganha nota interna ou "falou com", é assumido ou transferido, ou quando o nome ou o cadastro do contato muda (um aviso por chamado aberto dele), e `{"type": "connection", "sectorId": 1}` quando muda a conexão do número. A interface recarrega pela API o que mudou (TanStack Query), que continua sendo a única fonte dos dados e das permissões.
- Os eventos são publicados somente depois do commit da transação. A publicação não bloqueia: uma conexão lenta, com a fila de saída cheia, é encerrada, e a interface reconecta e recarrega tudo.
- A interface reconecta sozinha após queda, com espera crescente, e recarrega os dados ao reconectar, para não perder eventos do intervalo. Enquanto a conexão está caída, a tela mostra um aviso de que a atualização em tempo real foi interrompida.
- A sessão é conferida a cada minuto enquanto a conexão está aberta, sem renovar a expiração (só requisições do usuário renovam); sessão encerrada, expirada ou usuário desativado fecha a conexão.
- No desenvolvimento, o proxy do Vite repassa o WebSocket (`ws: true`); no Caddy, o `reverse_proxy` já o repassa.

## Autenticação

- Login com e-mail e senha (hash bcrypt), sessão gravada no PostgreSQL e cookie seguro (HttpOnly).
- Senhas redefinidas por administradores e supervisores; sem recuperação automática.
- Cookie `xet_session` com token aleatório de 32 bytes (somente o hash SHA-256 é gravado), `HttpOnly`, `SameSite=Lax` e `Secure` (desligável por `COOKIE_SECURE=false` no desenvolvimento sem HTTPS). Expiração deslizante de 12 horas, renovada a cada requisição autenticada.
- Limite de tentativas na tabela `login_attempts`, sem estado em memória: a tentativa é contada em transação, antes de conferir a senha, e bloqueio responde 429. O IP é o da conexão; com `TRUST_PROXY=true`, é o último valor de `X-Forwarded-For`, o que o Caddy grava. O Compose liga essa opção porque o backend só é alcançado pelo Caddy; fora disso ela fica desligada, para o cabeçalho não ser forjado.
- Senhas comuns: lista própria em `core/users/common_passwords.txt`, embutida no binário, sem serviço externo.
- Limpeza: uma rotina do serviço apaga, ao iniciar e a cada hora, as sessões expiradas e as tentativas de login vencidas.
- Rotas da API ficam sob `/api`. Sem sessão válida a resposta é 401; com sessão, mas sem permissão (papel ou setor), 403.
- O primeiro administrador é criado pelo comando `server create-admin` (nome, e-mail e senha), executado no próprio binário do backend; a senha é lida da entrada padrão para não ficar no histórico do shell (`make create-admin` / `make dev-create-admin`).

## Áudio e mídia

- O WhatsApp usa áudio OGG/Opus e o navegador grava em WebM/Opus (MP4 no Safari); o backend converte o áudio gravado com ffmpeg antes de enviar.
- A gravação chega na mesma rota de envio de arquivos (`POST /api/tickets/{id}/messages`, multipart), no campo `voice` em vez de `file`. O pacote `internal/helpdesk/audio` grava a entrada num arquivo temporário (MP4 exige leitura com saltos, que um pipe não permite), converte para OGG/Opus mono a 48 kHz (`libopus`, 32 kbit/s) e lê a duração da última página OGG. Só o arquivo convertido é guardado, com o tipo `audio/ogg; codecs=opus`, e enviado com a marcação de mensagem de voz (PTT no Whatsmeow).
- A conversão acontece depois da conferência de idempotência: repetir o envio devolve a mensagem registrada sem converter de novo.
- O `ffmpeg` (com `libopus`) precisa estar instalado onde o backend roda: na imagem Docker do backend, no CI e na máquina de desenvolvimento.
- Imagens e vídeos são exibidos com pré-visualização no painel. Áudios, recebidos ou gravados, tocam num player próprio, feito sobre um elemento `<audio>` sem os controles nativos, para seguir o design system. A rota `GET /api/media/{id}` atende pedidos parciais (`Range`), para os players avançarem e voltarem.

## Monitoramento

- Logs estruturados do backend.
- Status da conexão de cada setor visível no painel dos supervisores, com reconexão por QR code.
- Teste de carga simulando 120 atendentes simultâneos antes da expansão.

## Integração contínua

- GitHub Actions (`.github/workflows/ci.yml`) a cada PR e a cada push na `main`.
- Os jobs chamam os mesmos alvos do `Makefile` usados localmente, para que o CI e a máquina do desenvolvedor rodem a mesma coisa: `make lint`, `make test-backend`, `make test-e2e` e `make check-generated` (código do sqlc e `go mod tidy` em dia com o commit).
- Os runners Ubuntu já têm Docker, usado pelo testcontainers, pelo golangci-lint, pelo sqlc e pelo banco dos testes ponta a ponta.
- Cada job tem limite de 15 minutos, para que um passo travado (por exemplo, um mirror lento) falhe logo em vez de prender o runner.
- No CI o `ffmpeg` vem do binário estático da imagem `mwader/static-ffmpeg`, fixada por digest no `Makefile` (`make ci-ffmpeg`), em vez do `apt-get`, que levava mais de um minuto e chegou a travar.
- O lint do backend monta no container os caches do Go e do golangci-lint (`LINT_CACHE_DIR`, padrão `~/.cache/xet-lint`), guardados no CI com `actions/cache`.
- Quando os testes ponta a ponta falham, o relatório e os traces do Playwright ficam como artefato por 7 dias.
- Os testes ponta a ponta rodam contra o build de produção do frontend (`vite build` + `vite preview`, com o mesmo proxy de `/api`), não contra o servidor de desenvolvimento. O servidor de desenvolvimento compila cada módulo no primeiro acesso: com vários navegadores em paralelo e o cache vazio, como no CI, os primeiros carregamentos estouravam os tempos de espera e os testes falhavam ao acaso.

## Bibliotecas padrão

Estas são as bibliotecas adotadas como padrão. Incluir uma biblioteca fora desta lista exige justificativa registrada aqui antes de usá-la.

### Backend (Go)

O backend usa a biblioteca padrão do Go sempre que ela resolve bem; dependências externas só onde trazem ganho claro.

| Uso | Biblioteca |
| --- | --- |
| Linguagem | Go 1.26+ |
| Roteador HTTP | `github.com/go-chi/chi/v5` |
| Validação de entrada | `github.com/go-playground/validator/v10` |
| PostgreSQL | `github.com/jackc/pgx/v5` |
| WhatsApp | `go.mau.fi/whatsmeow` (sessões no PostgreSQL via `sqlstore`) |
| QR code | `github.com/skip2/go-qrcode`: gera no backend a imagem PNG do QR code de pareamento do Whatsmeow. Gerar a imagem no servidor evita uma biblioteca de QR no frontend; a tela só exibe a imagem |
| WebSocket | `github.com/coder/websocket` |
| Hash de senha | bcrypt de `golang.org/x/crypto` |
| Migrações | `github.com/pressly/goose/v3`, como biblioteca: as migrações ficam embutidas no binário e são aplicadas ao iniciar o servidor e na preparação dos testes |
| Testes de integração | `github.com/testcontainers/testcontainers-go` (PostgreSQL real) |
| Conversão de áudio | `ffmpeg` (binário no container, chamado via `os/exec`) |

Resolvido com a biblioteca padrão ou com o banco, sem dependência:

- Sessões de login: tabela `sessions` no PostgreSQL e cookie seguro (HttpOnly, expiração, novo identificador a cada login).
- Configuração: variáveis de ambiente lidas com `os.Getenv`.
- Logs: `log/slog`, saída JSON.
- Identificadores: gerados pelo PostgreSQL.
- Testes: pacote `testing`.

Ferramentas de desenvolvimento (não entram no binário, executadas via Docker com versão fixada no `Makefile`): `sqlc` (queries tipadas, `make sqlc`) e `golangci-lint`.

### Frontend (React)

| Uso | Biblioteca |
| --- | --- |
| Build | Vite |
| Linguagem | TypeScript (modo `strict`) |
| Framework | React |
| Rotas | React Router |
| Dados do servidor | TanStack Query |
| Formulários | React Hook Form + Zod (validação), ligados por `@hookform/resolvers` |
| Estilo | Tailwind CSS |
| Design system | `github:gcaspp-labs/glab-design-system` (tokens, logos), fixado por commit; aplicação em [design.md](design.md) |
| Componentes | shadcn/ui (estilo `base-nova`, sobre Base UI; padrão atual do shadcn), adaptado ao design system |
| Tema | Preferência guardada no `localStorage` do navegador, por aparelho, e aplicada em `data-theme` antes de pintar a tela. Não vai para o banco |
| Fontes | `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-serif`, `@fontsource/ibm-plex-mono` (servidas localmente) |
| Ícones | lucide-react, com traço 1,7 |
| Notificações na tela | sonner |
| Datas | date-fns (locale pt-BR) |
| Tempo real | WebSocket nativo do navegador |
| Gravação de áudio | MediaRecorder nativo do navegador |
| Testes ponta a ponta | Playwright |
| Lint | oxlint |
| Formatação | Prettier |

O oxlint substitui o ESLint: é o padrão do template atual do Vite e o projeto usa TypeScript 7, ainda não suportado pelo typescript-eslint.

## Estrutura do repositório

```
backend/                 Serviço Go
  cmd/server/            Ponto de entrada
  internal/core/         O que serve a todos os módulos
    auth/                Login, sessão, permissões e middlewares
    users/               Cadastro de usuários e senhas
    sectors/             Setores e módulos vendidos
    directory/           Órgãos e contatos
    audit/               Conjuntos de alterações da auditoria
    realtime/            Conexões WebSocket e eventos
    storage/             Armazenamento de arquivos
    httpx/               Leitura da requisição, respostas e erros
  internal/helpdesk/     Central de atendimento
    messaging/           Contrato e adaptadores do WhatsApp
    audio/               Conversão das gravações
  internal/server/       Monta o roteador com as rotas de cada módulo
  internal/testapi/      Sobe o servidor para os testes de integração
  internal/db/           Código gerado pelo sqlc (não editar)
  internal/config/       Configuração por variáveis de ambiente
  internal/testdb/       Bancos isolados para testes de integração
  db/migrations/         Migrações (goose), embutidas no binário
  db/queries/            SQL para o sqlc
frontend/                Aplicação React
deploy/                  Docker Compose, Caddyfile
```

`internal/core` não importa módulos, e um módulo importa só o `core` e os pacotes de apoio (`db`, `testdb`, `testapi`), nunca outro módulo. As duas regras são garantidas pelo `depguard`, em `backend/.golangci.yml`: o `make lint` falha se forem quebradas. Módulo novo ganha pasta própria em `internal/`, uma regra no `depguard` e uma linha em `internal/server`.

Cada pacote com rotas expõe um `Handler` com `Routes(r chi.Router)`; `internal/server` só os monta. As rotas de `auth` ficam fora da exigência de sessão, porque incluem o login, e as dos demais já chegam com ela.

Ficam como estão, porque separá-los exigiria mudar o banco ou uma regra: `core/users` consulta os chamados em andamento do usuário antes de desativá-lo; `sectors` mantém as colunas do WhatsApp, gravadas por `helpdesk/connection.go`; `audit_logs` mantém a chave para `tickets`. Pelo mesmo motivo, a rota de edição de contato (`PUT /api/contacts/{id}`) fica em `helpdesk/contact_http.go`: ela completa o órgão dos chamados abertos do contato, regra que é do atendimento.

### Um arquivo por assunto

Dentro de cada pacote, cada assunto tem um trio de arquivos: a regra de transferir fica em `helpdesk/transfer.go`, a rota em `helpdesk/transfer_http.go` e os testes em `helpdesk/transfer_test.go`, em pacote externo (`helpdesk_test`). A consulta fica no arquivo do assunto que ela lê, como as notas em `notes.go`. Assunto novo ganha um novo trio, e um arquivo não reúne assuntos diferentes.

Ficam sem trio os arquivos sem rota ou que servem a todos os assuntos. Em `helpdesk`: `service.go` (o serviço e seus auxiliares), `errors.go` (os erros do pacote), `errors_http.go` (as respostas de erro compartilhadas pelas rotas), `access.go` (quem vê e quem age no chamado), `inbound.go` (eventos recebidos do adaptador) e `routes.go` (o `Handler` e as rotas do módulo). Em `internal/testapi`, os auxiliares comuns dos testes; cada pacote de testes acrescenta os seus em `helpers_test.go`.

## Referências

- Whatsmeow: https://github.com/tulir/whatsmeow
- Documentação: https://pkg.go.dev/go.mau.fi/whatsmeow
