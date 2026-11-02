# Modelo de dados — Central de atendimento via WhatsApp

Domínios, entidades, ligações e regras de integridade. As regras de negócio estão em [spec.md](spec.md) e as decisões técnicas em [arquitetura.md](arquitetura.md).

Nomes de tabelas, colunas e valores estão em inglês, como no código. Todas as tabelas usam `id bigint generated always as identity` como chave primária e registram `created_at timestamptz not null default now()`; tabelas editáveis também têm `updated_at`. Horários são sempre `timestamptz`.

## Domínios

| Domínio | Pacote Go | Entidades | Responsabilidade |
| --- | --- | --- | --- |
| Organização interna | `internal/core/sectors` | Setor, Módulo | Setores e a lista de módulos de cada um |
| Conexão do número | `internal/helpdesk` | — (colunas do WhatsApp em Setor) | Ligar e desligar o número de WhatsApp de cada setor |
| Acesso | `internal/core/auth`, `internal/core/users` | Usuário, Sessão, Tentativas de login | Login, papéis e permissões; cadastro de usuários e senhas |
| Cadastro de clientes | `internal/core/directory` | Órgão, Contato | Pessoas atendidas e os órgãos a que pertencem |
| Atendimento | `internal/helpdesk` | Chamado, Módulos do chamado, Nota interna, Contador de protocolo | Ciclo de vida do chamado: fila, responsável, transferências, encerramento e correções |
| Mensagens | `internal/helpdesk` | Mensagem, Arquivo | Histórico de mensagens e anexos |
| Mensageria | `internal/helpdesk/messaging` | — (sessões do Whatsmeow) | Interface de envio e recebimento e implementação com Whatsmeow |
| Auditoria | `internal/core/audit` | Registro de auditoria | Histórico de alterações relevantes |

Dependências permitidas: `helpdesk` usa os pacotes de `core`, além de `helpdesk/messaging` e `helpdesk/audio`; `core` não usa `helpdesk`, garantido pelo `depguard`. Dentro de `core`, `users`, `sectors`, `directory` e `realtime` usam `auth`, e todos podem usar `audit` e `httpx`. `messaging` não conhece nenhum outro domínio e só emite eventos. Os pacotes gravam pelo código gerado em `db`, e `internal/server` monta as rotas de cada um.

## Diagrama

```mermaid
erDiagram
    sectors ||--o{ users : "atendentes e supervisores"
    sectors ||--o{ modules : possui
    sectors ||--o{ tickets : "fila do setor"
    users ||--o{ sessions : possui
    organizations ||--o{ contacts : "órgão principal"
    contacts ||--o{ tickets : abre
    contacts ||--o{ contact_sectors : ""
    sectors ||--o{ contact_sectors : ""
    contacts ||--o{ contact_modules : ""
    modules ||--o{ contact_modules : ""
    organizations ||--o{ tickets : "órgão do chamado"
    users ||--o{ tickets : "responsável"
    tickets ||--o| tickets : "chamado anterior (transferência entre setores)"
    tickets ||--o{ ticket_modules : ""
    modules ||--o{ ticket_modules : ""
    tickets ||--o{ messages : contém
    users ||--o{ messages : "autor (envio pelo sistema)"
    media_files ||--o| messages : anexo
    tickets ||--o{ internal_notes : contém
    users ||--o{ internal_notes : autor
    tickets ||--o{ audit_logs : ""
    users ||--o{ audit_logs : "autor da ação"
```

## Tipos enumerados

| Tipo | Valores | Significado |
| --- | --- | --- |
| `user_role` | `agent`, `supervisor`, `admin` | Atendente, supervisor do setor, administrador (supervisor global) |
| `connection_status` | `disconnected`, `connecting`, `connected`, `logged_out` | Estado da conexão do número do setor; `logged_out` exige novo QR code |
| `ticket_status` | `queued`, `in_progress`, `closed` | Na fila sem responsável, com responsável, encerrado |
| `closure_type` | `resolved`, `transferred`, `cancelled` | Encerrado normalmente, etapa encerrada por transferência entre setores ou cancelado sem lançar o atendimento |
| `message_direction` | `inbound`, `outbound` | Recebida do cliente ou enviada pelo setor |
| `message_origin` | `customer`, `agent`, `phone` | Enviada pelo cliente, por um atendente no sistema ou pelo celular fora do sistema |
| `message_type` | `text`, `image`, `video`, `audio`, `document`, `unsupported`, `media_unavailable` | `unsupported` cobre figurinhas, reações, localização e outros tipos fora do piloto; `media_unavailable` é o arquivo recebido acima do limite ou que não baixou |
| `message_status` | `pending`, `sent`, `delivered`, `read`, `failed` | Situação de entrega das mensagens enviadas |

## Organização interna

### `sectors` — Setor

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `name` | text | Obrigatório, único |
| `phone` | text | Opcional; único quando preenchido, somente dígitos com DDI (ex.: `5511999990000`); vem do número lido no QR code e é apagado ao desvincular; a migração apagou o digitado em setores sem conta vinculada |
| `provider` | text | Obrigatório; provedor de mensageria do setor: `whatsmeow` (piloto) ou `cloud_api` (futuro) |
| `external_account_id` | text | Identificador da conta no provedor (no Whatsmeow, o JID do aparelho vinculado após o QR code) |
| `connection_status` | connection_status | Padrão `disconnected` |
| `last_connected_at` | timestamptz | Última conexão bem-sucedida |
| `connection_error` | text | Motivo da recusa da última conexão (número já ligado a outro setor); limpo na conexão seguinte |
| `active` | boolean | Padrão `true` |

### `modules` — Módulo/sistema atendido pelo setor

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `sector_id` | bigint → `sectors` | Obrigatório |
| `name` | text | Obrigatório; único por setor (sem diferenciar maiúsculas) |
| `active` | boolean | Padrão `true` |

Módulos não são excluídos, apenas desativados, porque encerramentos antigos continuam referenciando-os. Módulos inativos não aparecem para novos encerramentos.

## Acesso

### `users` — Usuário

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `name` | text | Obrigatório |
| `email` | text | Obrigatório, único (sem diferenciar maiúsculas) |
| `password_hash` | text | bcrypt |
| `role` | user_role | Obrigatório |
| `sector_id` | bigint → `sectors` | Obrigatório para `agent` e `supervisor`; vazio para `admin` |
| `active` | boolean | Padrão `true`; usuário inativo não faz login |

Restrição: `(role = 'admin') = (sector_id is null)`.

Usuários não são excluídos, apenas desativados, porque continuam como autores de mensagens, chamados e auditoria. Com o usuário travado, a desativação e a troca de setor (inclusive ao virar administrador, que não tem setor) são recusadas se houver chamados `in_progress` com ele como responsável.

#### Permissões

| Ação | Atendente | Supervisor | Administrador |
| --- | --- | --- | --- |
| Ver fila e chamados | Próprio setor | Próprio setor | Todos os setores |
| Assumir, responder, transferir, encerrar | Próprio setor | Próprio setor | Todos os setores |
| Cancelar chamado na fila | Próprio setor | Próprio setor | Todos os setores |
| Cancelar ou devolver à fila chamado em atendimento | Só sendo o responsável | Próprio setor | Todos os setores |
| Corrigir chamado encerrado | Só os que encerrou | Próprio setor | Todos os setores |
| Gerenciar módulos | — | Próprio setor | Todos os setores |
| Redefinir senha | — | Usuários do próprio setor | Todos |
| Conectar e desvincular número (QR code) e ver status | — | Próprio setor | Todos os setores |
| Cadastrar setores e usuários | — | — | Sim |
| Cadastrar contatos e vinculá-los a um órgão | Sim | Sim | Sim |
| Alterar setores e módulos do contato | Próprio setor | Próprio setor | Todos os setores |
| Importar contatos do WhatsApp do setor | Próprio setor | Próprio setor | Todos os setores |
| Cadastrar e editar órgãos | — | Sim | Sim |

Transferir entre atendentes: o responsável transfere o próprio chamado; supervisor (do setor) e administrador transferem qualquer chamado em atendimento. O destino é um usuário ativo do setor do chamado (atendente ou supervisor).

Encerrar: somente o responsável pelo chamado em atendimento, inclusive quando é supervisor ou administrador.

### `sessions` — Sessão de login

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `token_hash` | text | Único; hash SHA-256 do token do cookie (o token em si nunca é gravado) |
| `user_id` | bigint → `users` | Obrigatório |
| `expires_at` | timestamptz | Obrigatório |
| `last_seen_at` | timestamptz | Atualizado no uso |

Um novo token é gerado a cada login. Desativar um usuário ou redefinir sua senha remove suas sessões. A expiração é deslizante: cada uso válido leva `expires_at` para 12 horas à frente. Sessões expiradas são apagadas periodicamente pelo serviço.

### `login_attempts` — Tentativas de login

Contagem de tentativas erradas por e-mail e por IP, sem ligação com `users`, porque e-mail não cadastrado também conta.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `scope` | text | `email` ou `ip`; check |
| `subject` | text | E-mail em minúsculas ou IP |
| `failures` | integer | Tentativas erradas seguidas |
| `last_failure_at` | timestamptz | Obrigatório; depois de 15 minutos a contagem recomeça |
| `locked_until` | timestamptz | Fim do bloqueio; vazio sem bloqueio |

Chave primária: `(scope, subject)`. Cada tentativa é contada na linha travada antes de conferir a senha, para tentativas simultâneas não passarem do limite. O login certo apaga a linha do e-mail e devolve a tentativa ao IP; redefinir a senha apaga a linha do e-mail. Linhas sem bloqueio ativo e com mais de 15 minutos são apagadas junto com as sessões expiradas.

## Cadastro de clientes

### `organizations` — Órgão

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `name` | text | Obrigatório |
| `cnpj` | char(14) | Opcional; sem pontuação, com letras maiúsculas e dígitos (CNPJ numérico ou alfanumérico), validado pelos dígitos verificadores; único quando informado (índice único parcial) |

### `contacts` — Contato (pessoa física)

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `name` | text | Obrigatório; para números desconhecidos, preenchido com o nome do perfil do WhatsApp ou o telefone |
| `phone` | text | Único quando preenchido, somente dígitos com DDI; obrigatório para contato cadastrado (vazio só em contato criado automaticamente sem telefone conhecido, identificado apenas por LID) |
| `external_contact_id` | text | Identificador do contato no provedor, usado para casar mensagens recebidas; único quando preenchido |
| `organization_id` | bigint → `organizations` | Órgão principal; vazio para contato ainda não vinculado |
| `registered` | boolean | `false` para contatos criados automaticamente a partir de número desconhecido; `true` após cadastro pelo atendente ou importação com órgão |

Restrições: `registered` ⇒ `organization_id` e `phone` preenchidos (contato cadastrado pelo atendente sempre tem órgão e telefone).

O cadastro de contatos e órgãos é único para todos os setores. Os órgãos são pré-cadastrados por supervisores e administradores; no atendimento, o atendente apenas vincula a pessoa a um órgão existente.

Busca: por nome do contato ou do órgão (índice `pg_trgm` para busca parcial, sem diferenciar maiúsculas nem acentos), por telefone e por CNPJ. Os acentos são removidos pela extensão `unaccent`, por meio da função `immutable_unaccent(text)`, que fixa o dicionário para poder ser usada nos índices de nome.

CNPJ: desde julho de 2026 a Receita Federal emite CNPJ alfanumérico (IN RFB 2.229/2024): as 12 primeiras posições aceitam letras maiúsculas e dígitos, e os 2 dígitos verificadores continuam numéricos. A validação usa o cálculo do módulo 11 com o valor de cada caractere igual ao código ASCII menos 48, que vale também para o CNPJ numérico. CNPJ com todos os caracteres iguais é recusado.

Casamento de mensagens recebidas: números brasileiros podem chegar com ou sem o nono dígito, e o WhatsApp pode identificar contatos por LID em vez do telefone. A mensagem é ligada ao contato pelo `external_contact_id` resolvido pelo adaptador. Sem contato com esse identificador, procura-se o contato pelo telefone ou por sua variante com ou sem o nono dígito (celular brasileiro: `55` + DDD + `9` + 8 dígitos ou `55` + DDD + 8 dígitos começando por 6 a 9), preferindo o telefone exato; se ele ainda não tiver `external_contact_id`, passa a ter o identificador. Sem nenhum dos dois, é criado um contato com `registered = false`.

Corrida do nono dígito: a restrição de telefone único não vê as duas variantes como o mesmo número. Por isso, a recepção de mensagens e a importação tomam, na transação, uma trava consultiva (`pg_advisory_xact_lock`) pela variante mais curta do telefone antes de procurar e criar o contato. A importação toma as travas em ordem, para não haver impasse. O cadastro manual continua comparando só o telefone exato.

### `contact_sectors` — Setores do contato

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `contact_id` | bigint → `contacts` | Chave primária composta |
| `sector_id` | bigint → `sectors` | Chave primária composta |

O setor organiza a lista de contatos e não restringe o acesso. O vínculo é criado no cadastro, na importação e, na mesma transação da ação, quando o contato escreve para o número do setor, recebe uma conversa iniciada por ele ou mensagem do celular do setor, ou é transferido para ele (`insert ... on conflict do nothing`). A migração preenche a tabela a partir dos chamados existentes; contatos sem chamado ficam sem setor até serem editados.

Índice: `(sector_id, contact_id)` para o filtro da lista.

### `contact_modules` — Módulos do contato

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `contact_id` | bigint → `contacts` | Chave primária composta |
| `module_id` | bigint → `modules` | Chave primária composta |
| `sector_id` | bigint | Setor do módulo; `(module_id, sector_id)` → `modules` e `(contact_id, sector_id)` → `contact_sectors`, de modo que o módulo seja de um setor do contato; único com `contact_id` |

Opcional, com no máximo um módulo por setor do contato. Tirar um setor do contato remove o módulo desse setor na mesma transação (`on delete cascade`). Módulo novo precisa estar ativo; o já vinculado pode continuar depois de desativado. Vínculos de setores que o usuário não altera são preservados ao salvar (ver Permissões). Índice: `(module_id)` para o filtro da lista.

## Atendimento

### `tickets` — Chamado

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `protocol` | text | Obrigatório, único; formato `AAAA-NNNNNN` |
| `sector_id` | bigint → `sectors` | Obrigatório |
| `contact_id` | bigint → `contacts` | Obrigatório |
| `organization_id` | bigint → `organizations` | Copiado do órgão principal do contato; editável no encerramento; obrigatório para encerrar, exceto no cancelamento |
| `assignee_id` | bigint → `users` | Responsável atual |
| `status` | ticket_status | Obrigatório |
| `previous_ticket_id` | bigint → `tickets` | Chamado de origem em transferência entre setores; único |
| `created_by_id` | bigint → `users` | Preenchido quando o atendente iniciou a conversa |
| `spoke_with` | text | "Falou com", para telefones usados por mais de uma pessoa |
| `arrived_at` | timestamptz | Obrigatório; primeira mensagem do chamado |
| `assigned_at` | timestamptz | Primeira vez que alguém assumiu; não muda em transferências nem ao devolver à fila; vazio em chamado cancelado direto da fila |
| `started_at` | timestamptz | Obrigatório; padrão `arrived_at`; editável no encerramento |
| `ended_at` | timestamptz | Preenchido ao encerrar; editável |
| `closed_at` | timestamptz | Momento real do encerramento; não editável |
| `closed_by_id` | bigint → `users` | Quem encerrou ou cancelou |
| `closure_type` | closure_type | Preenchido ao encerrar |
| `subject` | text | Obrigatório para encerrar, exceto no cancelamento |
| `resolution` | text | Obrigatório para encerrar, exceto no cancelamento |

Restrições:

- `status = 'queued'` ⇒ `assignee_id` vazio.
- `status in ('in_progress', 'closed')` ⇒ `assignee_id` preenchido.
- `status = 'closed'` ⇒ `ended_at`, `closed_at`, `closed_by_id` e `closure_type` preenchidos e, exceto em `closure_type = 'cancelled'`, também `organization_id`, `subject` e `resolution`.
- `ended_at >= started_at`.
- Índice único parcial em `(sector_id, contact_id) where status <> 'closed'`: um chamado aberto por contato e setor.
- Encerrar exige ao menos um registro em `ticket_modules` (validado na transação de encerramento).
- O contato do chamado precisa estar com `registered = true` para encerrar.

Índices: `(sector_id, status)` para a fila; `(assignee_id) where status = 'in_progress'` para a contagem por atendente; `(contact_id)` e `(organization_id)` para o histórico; `(sector_id, closed_at) where status = 'closed'` para os realizados do dia.

### `ticket_modules` — Módulos atendidos no chamado

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `ticket_id` | bigint → `tickets` | Chave primária composta |
| `module_id` | bigint → `modules` | Chave primária composta; o módulo deve ser do setor do chamado |

### `internal_notes` — Nota interna

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `ticket_id` | bigint → `tickets` | Obrigatório |
| `author_id` | bigint → `users` | Obrigatório |
| `body` | text | Obrigatório |

Índice: `(ticket_id, created_at)` para exibir as notas do chamado.

Notas não são editadas nem excluídas. Qualquer pessoa com acesso ao setor do chamado escreve notas, mesmo sem ser o responsável e após o encerramento. Ficam visíveis para quem pode ver o chamado e, após transferência entre setores, para o setor de destino.

### `protocol_counters` — Contador de protocolo

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `year` | integer | Chave primária |
| `last_value` | integer | Último número usado no ano |

O protocolo é gerado na mesma transação que cria o chamado, com `insert ... on conflict (year) do update set last_value = last_value + 1 returning last_value`. A numeração é única para todos os setores e reinicia a cada ano, contado no horário de Brasília (`America/Sao_Paulo`).

### Ciclo de vida do chamado

```mermaid
stateDiagram-v2
    [*] --> queued: mensagem do cliente ou enviada pelo celular sem chamado aberto
    [*] --> in_progress: atendente inicia conversa
    queued --> in_progress: atendente assume
    in_progress --> in_progress: transferência entre atendentes
    in_progress --> closed: encerramento (resolved)
    in_progress --> closed: transferência entre setores (transferred)
    in_progress --> queued: devolver à fila
    queued --> closed: cancelamento (cancelled)
    in_progress --> closed: cancelamento (cancelled)
    closed --> [*]
```

| Evento | Efeito |
| --- | --- |
| Mensagem do cliente sem chamado aberto no setor | Cria chamado `queued` com `arrived_at` = horário da mensagem |
| Mensagem do cliente com chamado aberto | Entra no chamado existente |
| Mensagem enviada pelo celular sem chamado aberto | Cria chamado `queued`; mensagem com origem `phone` |
| Atendente inicia conversa | Cria chamado `in_progress` com `assignee_id` e `created_by_id` = atendente e `arrived_at` = envio; auditoria `ticket_started` na mesma transação |
| Assumir | `update ... set assignee_id = :user, status = 'in_progress', assigned_at = coalesce(assigned_at, now()) where id = :id and status = 'queued'`; nenhuma linha afetada significa que outro atendente assumiu antes |
| Transferência entre atendentes | Com o chamado travado (`for update`) e `in_progress`, troca `assignee_id`; auditoria `ticket_transferred_user` com `assignee_id` de/para na mesma transação. Repetir a transferência para quem já é o responsável não grava de novo |
| Encerramento | Com o chamado travado (`for update`), `in_progress` e o usuário como responsável, e o contato travado para leitura (`for share`) e cadastrado: preenche os campos de encerramento com `closure_type = 'resolved'`, `closed_at = now()`, `closed_by_id` = responsável e `ended_at` informado ou `now()`; grava `ticket_modules` (módulos ativos do setor) e a auditoria `ticket_closed` na mesma transação |
| Transferência entre setores | Com as mesmas travas e conferências do encerramento (somente o responsável), encerra com o formulário completo e `closure_type = 'transferred'`; cria chamado `queued` no destino (outro setor ativo) com `previous_ticket_id`, mesmo contato, o órgão do formulário e `arrived_at` = momento da transferência. Se o contato já tiver chamado aberto no destino (índice único parcial), a transação é desfeita e a transferência recusada. Auditoria `ticket_transferred_sector` na origem, na mesma transação. Os eventos dos dois setores são publicados depois do commit |
| Cadastro do contato | Na mesma transação do cadastro, os chamados abertos do contato com `organization_id` vazio recebem o órgão do contato (travados com `for update`), com auditoria `ticket_organization_linked` em cada um |
| Correção | Com o chamado travado (`for update`) e `closed`, por quem encerrou (`closed_by_id`), supervisor do setor ou administrador: altera `subject`, `resolution`, `organization_id`, `started_at`, `ended_at` e `spoke_with` e acrescenta ou remove linhas de `ticket_modules` (acrescentadas só entre os módulos ativos do setor; as já gravadas podem ficar mesmo inativas); auditoria `ticket_corrected` com `reason` na mesma transação. Sem nenhuma alteração, nada é gravado |
| Devolver à fila | Com o chamado travado (`for update`) e `in_progress`, pelo responsável, supervisor do setor ou administrador: `status = 'queued'`, `assignee_id` vazio, `assigned_at` mantido; auditoria `ticket_returned` na mesma transação |
| Cancelamento | Com o chamado travado (`for update`) e aberto, conforme as permissões: `closure_type = 'cancelled'`, `closed_at` e `ended_at` = agora (`ended_at` nunca antes de `started_at`, que vem do relógio do celular), `closed_by_id` = quem cancelou; vindo da fila, `assignee_id` = quem cancelou, porque chamado encerrado exige responsável (`assigned_at` fica vazio). Não exige contato cadastrado nem `ticket_modules`; auditoria `ticket_cancelled` com `reason` na mesma transação. Chamado cancelado não é corrigido |
| Mensagem após encerramento | Cria novo chamado (não reabre) |

Chamados não são reabertos. O destino de uma transferência entre setores vê o histórico seguindo a cadeia de `previous_ticket_id`: quem tem acesso ao setor de um chamado lê também todos os chamados anteriores da cadeia (detalhe, mensagens, arquivos, notas, módulos e correções), sem poder agir neles. A origem vê o setor e o protocolo do chamado seguinte, sem acesso a ele.

## Mensagens

### `messages` — Mensagem

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `ticket_id` | bigint → `tickets` | Obrigatório |
| `sector_id` | bigint → `sectors` | Obrigatório; número pelo qual a mensagem passou |
| `contact_id` | bigint → `contacts` | Obrigatório |
| `direction` | message_direction | Obrigatório |
| `origin` | message_origin | Obrigatório |
| `author_id` | bigint → `users` | Obrigatório quando `origin = 'agent'`; vazio nos demais |
| `type` | message_type | Obrigatório |
| `body` | text | Texto ou legenda |
| `media_id` | bigint → `media_files` | Anexo, quando houver |
| `external_message_id` | text | Identificador da mensagem no provedor; preenchido na recepção ou após o envio aceito |
| `client_request_id` | uuid | Gerado pela interface a cada envio; impede envio duplicado em clique duplo ou nova tentativa |
| `status` | message_status | Usado nas mensagens enviadas |
| `failure_reason` | text | Motivo quando `status = 'failed'` |
| `sent_at` | timestamptz | Obrigatório; horário da mensagem segundo o WhatsApp |

Restrições:

- Único em `(sector_id, external_message_id)` quando preenchido: garante idempotência em reconexões e reentregas.
- Único em `client_request_id` quando preenchido: garante idempotência no envio pelo sistema.
- `direction = 'inbound'` ⇔ `origin = 'customer'`.
- `type in ('image', 'video', 'audio', 'document')` ⇒ `media_id` preenchido. `media_unavailable` não tem `media_id`; `body` guarda a legenda ou o nome do arquivo.

Índice: `(ticket_id, sent_at)` para exibir a conversa.

Mensagens enviadas pelo celular fora do sistema (`origin = 'phone'`) são gravadas com `status = 'sent'`, sem autor.

Mensagens enviadas pelo sistema são gravadas como `pending` (com `sent_at` no momento do registro) e passam a `sent` com o `external_message_id` quando o provedor aceita, ou a `failed` com `failure_reason`. As confirmações do provedor só avançam a situação (`sent` → `delivered` → `read`); uma falha informada pelo provedor só vale para mensagens `pending` ou `sent`, e uma entrega confirmada vale também sobre `failed`. O reenvio pelo responsável volta a mensagem de `failed` para `pending` com a mesma chave de idempotência (`client_request_id`).

Mensagens não são editadas nem excluídas.

### `media_files` — Arquivo

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `storage_key` | text | Obrigatório, único; caminho na interface de armazenamento |
| `mime_type` | text | Obrigatório |
| `size_bytes` | bigint | Obrigatório |
| `file_name` | text | Nome original, quando houver |
| `sha256` | text | Obrigatório |
| `duration_seconds` | integer | Áudio e vídeo |

O arquivo é gravado no armazenamento antes de a mensagem ser confirmada no banco.

## Auditoria

### `audit_logs` — Registro de auditoria

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `ticket_id` | bigint → `tickets` | Preenchido em ações sobre chamados |
| `entity_type` | text | Ex.: `ticket`, `user`, `sector`, `module` |
| `entity_id` | bigint | Obrigatório |
| `action` | text | Ver tabela abaixo |
| `actor_id` | bigint → `users` | Quem fez; vazio para ações do sistema |
| `reason` | text | Obrigatório em correções e cancelamentos |
| `changes` | jsonb | Valores anteriores e novos: `{"campo": {"from": ..., "to": ...}}` |

Índices: `(ticket_id, created_at)` e `(entity_type, entity_id)`.

Restrição: `action in ('ticket_corrected', 'ticket_cancelled')` ⇒ `reason` preenchido e não em branco (`audit_logs_correction_reason`, ampliada para o cancelamento).

A tabela é criada na T03 (primeira ação auditada: redefinição de senha), antes de existir `tickets`; a chave estrangeira de `ticket_id` é adicionada na migração que cria `tickets`.

| Ação | Quando |
| --- | --- |
| `ticket_assigned` | Atendente assume chamado |
| `ticket_started` | Atendente inicia conversa; o chamado nasce assumido por ele |
| `ticket_transferred_user` | Transferência entre atendentes |
| `ticket_transferred_sector` | Transferência entre setores (no chamado de origem): `changes` como no `ticket_closed`, com `status`, `subject`, `resolution`, `module_ids`, `ended_at` e, quando alterados, `started_at` e `organization_id`, mais `next_ticket_id` e `sector_id` (de origem para destino) |
| `ticket_organization_linked` | Cadastro do contato preenche o órgão de um chamado aberto que estava sem órgão (`changes` com `organization_id` de vazio para o órgão) |
| `ticket_closed` | Encerramento: `changes` com `status`, `subject`, `resolution`, `module_ids`, `ended_at` e, quando alterados no formulário, `started_at` (de `arrived_at` para o informado) e `organization_id` |
| `ticket_corrected` | Correção de chamado encerrado (exige `reason`): `changes` só com os campos alterados entre `subject`, `resolution`, `organization_id`, `module_ids` (listas ordenadas), `started_at`, `ended_at` e `spoke_with` |
| `ticket_cancelled` | Cancelamento (exige `reason`): `changes` com `status`, `closure_type`, `ended_at` e, vindo da fila, `assignee_id` |
| `ticket_returned` | Devolver à fila: `changes` com `status` e `assignee_id` |
| `user_created`, `user_updated`, `user_password_reset` | Administração de usuários |
| `sector_created`, `sector_updated`, `sector_connected`, `sector_disconnected` | Administração e conexão de setores |
| `module_created`, `module_updated` | Administração de módulos |
| `organization_created`, `organization_updated` | Administração de órgãos |
| `contact_links_updated` | Cadastro ou edição muda setores ou módulos do contato, na entidade `contact`: `changes` só com o que mudou entre `sector_ids` e `module_ids` (listas ordenadas) |
| `contact_sector_linked` | Contato entra no setor sozinho ou pela importação, na entidade `contact`: `changes` com `sector_id` de vazio para o setor; `actor_id` vazio em mensagem recebida ou enviada pelo celular, e quem agiu na nova conversa, na transferência e na importação. Vínculo já existente não gera registro |
| `contacts_imported` | Importação de contatos, na entidade `sector`: `changes` com as quantidades de contatos criados (`created`) e já existentes (`existing`), de vazio para o número |

Conexão do número: `sector_connected` é gravado quando o setor passa a `connected` vindo de outro estado ou com outra conta vinculada; `sector_disconnected`, quando sai de `connected`. Os estados intermediários (`connecting`) e as reconexões automáticas que não passam por `connected` não geram auditoria. Os dois registros são ações do sistema (`actor_id` vazio), exceto ao desvincular pela tela de conexão, quando `sector_disconnected` guarda o autor, mesmo que a conexão já estivesse caída; repetir não gera novo registro. Guardam em `changes` o estado da conexão, a conta vinculada, o telefone e o motivo da recusa. Número recusado por já estar em outro setor não chega a `connected` e por isso não gera `sector_connected`.

Registros de auditoria nunca são alterados nem excluídos.

## Sessões do Whatsmeow

O Whatsmeow cria e mantém as próprias tabelas (prefixo `whatsmeow_`) no mesmo banco, por meio do `sqlstore`. Elas não são alteradas pelas migrações do sistema; a ligação com o setor é feita por `sectors.external_account_id`. Essas tabelas pertencem ao adaptador Whatsmeow e deixam de existir quando todos os setores migrarem para a API oficial.
