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
- **Disco local no piloto:** a interface de armazenamento fica em `internal/storage`, com a implementação em disco sob o diretório `STORAGE_DIR` (padrão `data/media`, relativo ao diretório do backend; no Docker Compose, o volume `media-data` em `/data/media`). Cada arquivo recebe uma chave aleatória organizada por ano e mês (`2026/10/<hex>`).

## Adaptador de mensageria

A migração futura para a API oficial do WhatsApp (Cloud API) deve consistir em escrever um novo adaptador, sem alterar regras de atendimento nem dados.

### Contrato

O pacote `internal/messaging` define a interface e os tipos neutros; cada provedor fica em um subpacote (`internal/messaging/whatsmeow`, futuramente `internal/messaging/cloudapi`).

- **Envio:** `SendText`, `SendMedia` (imagem, vídeo, áudio, documento) com destinatário, conteúdo e identificador de idempotência; retorna o identificador externo da mensagem.
- **Eventos recebidos:** mensagem recebida, mensagem enviada por fora do sistema, atualização de status (enviada, entregue, lida, falhou), mudança de conexão. O adaptador entrega eventos já traduzidos para os tipos neutros; o domínio nunca vê tipos do provedor.
- **Mídia:** o adaptador baixa a mídia e entrega o conteúdo; o domínio grava pelo adaptador de armazenamento.
- **Conexão:** iniciar, encerrar e consultar status por setor. O pareamento por QR code é específico do Whatsmeow e fica fora do contrato comum, exposto apenas pelo adaptador Whatsmeow.
- **Contato:** resolver telefone em identificador externo do contato.

### Conexão do número

- Ao iniciar, o serviço reconecta cada setor ativo que tem conta vinculada (`external_account_id`); as chaves ficam nas tabelas do `sqlstore` do Whatsmeow.
- Conectar um setor sem conta vinculada inicia o pareamento: a API devolve o QR code como imagem PNG, gerada no backend, e a tela mostra a imagem. O código do QR muda a cada 20 segundos (o primeiro dura 60); depois de cerca de 2 minutos sem leitura, o pareamento expira e o setor volta a desconectado.
- O adaptador traduz os estados de conexão em eventos `ConnectionChanged`; o domínio grava o estado no setor. Desvinculado pelo celular (`logged_out`), o setor perde a conta vinculada e só volta por novo QR code.
- A tela de conexão e o alerta de desconexão acompanham o estado pelo WebSocket (ver Tempo real). Cada novo código do QR é informado pelo adaptador como um novo `ConnectionChanged` com `connecting`, sem mudança de estado nem auditoria, para a tela trocar a imagem sozinha; o botão de atualizar fica só como recurso extra.

### Adaptador falso

- `internal/messaging/fake` implementa o contrato para os testes de integração do backend.
- Com `MESSAGING_PROVIDER=fake`, o servidor usa o adaptador falso no lugar do Whatsmeow. Esse modo existe para os testes ponta a ponta, que rodam contra o backend real: só nele existem as rotas `/api/test/messaging/...`, que simulam a leitura e a troca do QR code, a desconexão do número, mensagens de texto recebidas e confirmações de entrega e leitura das mensagens enviadas. O padrão é `whatsmeow`, e em produção essas rotas não existem.

### Regras

- Nada fora de `internal/messaging/<provedor>` importa bibliotecas do provedor.
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
- Um único endpoint, `GET /api/ws`, autenticado pelo cookie de sessão. O servidor mantém em memória apenas as conexões abertas (pacote `internal/realtime`), protegidas por mutex; cada conexão guarda o usuário e só recebe eventos dos setores a que ele tem acesso.
- Os eventos são avisos, não dados: `{"type": "ticket", "sectorId": 1, "ticketId": 10}` quando um chamado é criado, recebe ou envia mensagem, muda a situação de entrega de uma mensagem, ganha nota interna ou "falou com", ou é assumido, e `{"type": "connection", "sectorId": 1}` quando muda a conexão do número. A interface recarrega pela API o que mudou (TanStack Query), que continua sendo a única fonte dos dados e das permissões.
- Os eventos são publicados somente depois do commit da transação. A publicação não bloqueia: uma conexão lenta, com a fila de saída cheia, é encerrada, e a interface reconecta e recarrega tudo.
- A interface reconecta sozinha após queda, com espera crescente, e recarrega os dados ao reconectar, para não perder eventos do intervalo. Enquanto a conexão está caída, a tela mostra um aviso de que a atualização em tempo real foi interrompida.
- A sessão é conferida a cada minuto enquanto a conexão está aberta, sem renovar a expiração (só requisições do usuário renovam); sessão encerrada, expirada ou usuário desativado fecha a conexão.
- No desenvolvimento, o proxy do Vite repassa o WebSocket (`ws: true`); no Caddy, o `reverse_proxy` já o repassa.

## Autenticação

- Login com e-mail e senha (hash bcrypt), sessão gravada no PostgreSQL e cookie seguro (HttpOnly).
- Senhas redefinidas por administradores e supervisores; sem recuperação automática.
- Cookie `xet_session` com token aleatório de 32 bytes (somente o hash SHA-256 é gravado), `HttpOnly`, `SameSite=Lax` e `Secure` (desligável por `COOKIE_SECURE=false` no desenvolvimento sem HTTPS). Expiração deslizante de 12 horas, renovada a cada requisição autenticada.
- Rotas da API ficam sob `/api`. Sem sessão válida a resposta é 401; com sessão, mas sem permissão (papel ou setor), 403.
- O primeiro administrador é criado pelo comando `server create-admin` (nome, e-mail e senha), executado no próprio binário do backend; a senha é lida da entrada padrão para não ficar no histórico do shell (`make create-admin` / `make dev-create-admin`).

## Áudio e mídia

- O WhatsApp usa áudio OGG/Opus e o navegador grava em WebM/Opus; o backend converte o áudio gravado com ffmpeg antes de enviar.
- Imagens e vídeos recebidos são exibidos com pré-visualização no painel.

## Monitoramento

- Logs estruturados do backend.
- Status da conexão de cada setor visível no painel dos supervisores, com reconexão por QR code.
- Teste de carga simulando 120 atendentes simultâneos antes da expansão.

## Integração contínua

- GitHub Actions (`.github/workflows/ci.yml`) a cada PR e a cada push na `main`.
- Os jobs chamam os mesmos alvos do `Makefile` usados localmente, para que o CI e a máquina do desenvolvedor rodem a mesma coisa: `make lint`, `make test-backend`, `make test-e2e` e `make check-generated` (código do sqlc e `go mod tidy` em dia com o commit).
- Os runners Ubuntu já têm Docker, usado pelo testcontainers, pelo golangci-lint, pelo sqlc e pelo banco dos testes ponta a ponta.
- Quando os testes ponta a ponta falham, o relatório e os traces do Playwright ficam como artefato por 7 dias.

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
backend/            Serviço Go
  cmd/server/       Ponto de entrada
  internal/         Domínio, HTTP, mensageria, armazenamento
  internal/db/      Código gerado pelo sqlc (não editar)
  internal/testdb/  Bancos isolados para testes de integração
  db/migrations/    Migrações (goose), embutidas no binário
  db/queries/       SQL para o sqlc
frontend/           Aplicação React
deploy/             Docker Compose, Caddyfile
```

## Referências

- Whatsmeow: https://github.com/tulir/whatsmeow
- Documentação: https://pkg.go.dev/go.mau.fi/whatsmeow
