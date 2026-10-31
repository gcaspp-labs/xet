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

## Adaptador de mensageria

A migração futura para a API oficial do WhatsApp (Cloud API) deve consistir em escrever um novo adaptador, sem alterar regras de atendimento nem dados.

### Contrato

O pacote `internal/messaging` define a interface e os tipos neutros; cada provedor fica em um subpacote (`internal/messaging/whatsmeow`, futuramente `internal/messaging/cloudapi`).

- **Envio:** `SendText`, `SendMedia` (imagem, vídeo, áudio, documento) com destinatário, conteúdo e identificador de idempotência; retorna o identificador externo da mensagem.
- **Eventos recebidos:** mensagem recebida, mensagem enviada por fora do sistema, atualização de status (enviada, entregue, lida, falhou), mudança de conexão. O adaptador entrega eventos já traduzidos para os tipos neutros; o domínio nunca vê tipos do provedor.
- **Mídia:** o adaptador baixa a mídia e entrega o conteúdo; o domínio grava pelo adaptador de armazenamento.
- **Conexão:** iniciar, encerrar e consultar status por setor. O pareamento por QR code é específico do Whatsmeow e fica fora do contrato comum, exposto apenas pelo adaptador Whatsmeow.
- **Contato:** resolver telefone em identificador externo do contato.

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

## Autenticação

- Login com e-mail e senha (hash bcrypt), sessão gravada no PostgreSQL e cookie seguro (HttpOnly).
- Senhas redefinidas por administradores e supervisores; sem recuperação automática.

## Áudio e mídia

- O WhatsApp usa áudio OGG/Opus e o navegador grava em WebM/Opus; o backend converte o áudio gravado com ffmpeg antes de enviar.
- Imagens e vídeos recebidos são exibidos com pré-visualização no painel.

## Monitoramento

- Logs estruturados do backend.
- Status da conexão de cada setor visível no painel dos supervisores, com reconexão por QR code.
- Teste de carga simulando 120 atendentes simultâneos antes da expansão.

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
| Formulários | React Hook Form + Zod (validação) |
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
