# Central de atendimento via WhatsApp

## Objetivo

Criar um sistema próprio de atendimento para substituir a operação compartilhada pelo WhatsApp Web, com identificação dos atendentes, filas, responsáveis, transferências, histórico e registro formal ao finalizar cada atendimento.

Nesta etapa, todos os registros ficarão no novo sistema. Não haverá integração nem lançamento automático no sistema legado.

## Estrutura e implantação

- A empresa possui seis setores: Contabilidade, Suprimentos, Tributos, RH, GED e Social.
- Setores serão cadastrados livremente no sistema, cada um com seu número de WhatsApp, vinculado pelo QR code. No início, apenas a Contabilidade será cadastrada.
- Hoje há até quatro atendentes por setor. A solução deverá contemplar expansão para até 20 por setor, totalizando 120 atendentes.
- O piloto será feito no setor de Contabilidade.
- A conexão inicial será feita com Whatsmeow, biblioteca em Go que utiliza o protocolo do WhatsApp Web.
- O sistema será hospedado inicialmente em servidor da própria empresa, podendo migrar para uma VPS. A implantação não deve depender de recursos específicos do servidor local, para que a migração seja simples. Em servidor local, a disponibilidade depende da internet e da energia do escritório, e o acesso externo, se necessário, exigirá publicação segura (HTTPS).
- A validação roda no servidor da empresa, publicado por Cloudflare Tunnel em subdomínio de `gcaspp.com.br`, sem porta de entrada aberta. Todos usam o mesmo endereço, no escritório e em casa; sem internet no escritório, ninguém acessa. O Cloudflare Access fica na frente do sistema: em casa, código por e-mail só para os e-mails da equipe; no escritório, liberado pelo IP da empresa. O login do sistema continua valendo nos dois casos.
- A Cloudflare vê o tráfego aberto, inclusive conversas e senhas. Antes de usar dados reais, quem responde pela LGPD na empresa precisa avaliar esse ponto.
- O Whatsmeow é uma conexão não oficial; a operação precisa considerar manutenção da integração e possíveis desconexões. A camada de conexão deve permitir uma futura substituição sem alterar os registros de atendimento.
- Riscos conhecidos: o celular principal precisa se conectar periodicamente (cerca de 14 dias) para manter os dispositivos vinculados, e iniciar muitas conversas com números novos aumenta o risco de banimento.

## Funcionalidades

As regras de cada funcionalidade, como o sistema funciona hoje, ficam em `docs/features/`. Este documento guarda só o que vale para o sistema todo.

| Funcionalidade | Arquivo | Do que trata |
| --- | --- | --- |
| Usuários e acesso | [access.md](docs/features/access.md) | Como cada funcionário entra no sistema e o que cada papel pode fazer. Vale para atendentes, supervisores e administradores. |
| Administração | [administration.md](docs/features/administration.md) | Cadastro de usuários, setores e módulos. O administrador cadastra usuários e setores; o supervisor cuida das listas do próprio setor. |
| Conexão do número | [connection.md](docs/features/connection.md) | Cada setor tem um número de WhatsApp, ligado ao sistema pelo QR code. Supervisores e administradores conectam, acompanham e desvinculam o número. |
| Órgãos e contatos | [directory.md](docs/features/directory.md) | O cadastro de quem é atendido: os órgãos públicos clientes, com o município, e os contatos, que são as pessoas que conversam pelo WhatsApp. |
| Importar contatos do WhatsApp | [contact-import.md](docs/features/contact-import.md) | Traz para o cadastro os contatos salvos na agenda do número do setor. É sempre uma ação manual, feita por qualquer papel. |
| Recebimento e distribuição | [queue.md](docs/features/queue.md) | Como as mensagens viram chamados na fila do setor e como alguém assume. Inclui o painel e os atendimentos realizados no dia. |
| Notificações | [notifications.md](docs/features/notifications.md) | O sino do cabeçalho e os alertas do navegador avisam dos chamados na fila e dos números desconectados. |
| Conversa | [conversation.md](docs/features/conversation.md) | A troca de mensagens com o cliente dentro do chamado: texto, arquivos, áudio, situação de entrega e histórico. |
| Iniciar conversa | [start-conversation.md](docs/features/start-conversation.md) | A equipe busca um contato e começa a conversa pelo número do próprio setor. Iniciar já conta como assumir o chamado. |
| Transferências | [transfers.md](docs/features/transfers.md) | Passar o chamado para outra pessoa do setor, devolvê-lo à fila ou levá-lo a outro setor, sem perder o histórico. |
| Encerramento e correções | [closing.md](docs/features/closing.md) | O formulário que registra cada atendimento ao finalizar e a correção posterior dos dados, sempre com auditoria. |
| Assuntos e soluções | [subjects.md](docs/features/subjects.md) | Cada setor tem uma lista de assuntos, e cada assunto, uma lista de soluções, sugeridas no formulário de encerramento. O supervisor cuida das listas do setor pela tela Assuntos. |
| Cancelamento | [cancellation.md](docs/features/cancellation.md) | Finaliza um chamado sem lançar o atendimento, para spam, golpes e engano. |
| Dashboard do atendimento | [dashboard.md](docs/features/dashboard.md) | Mostra a situação e o desempenho do atendimento, com filtros. É só leitura, para supervisores e administradores. |
| Interface geral | [interface.md](docs/features/interface.md) | Regras que valem para todas as telas: acessibilidade e o comportamento das janelas de formulário. |

Fora do piloto: etiquetas, importação por planilha, grupos, exibição de reações, figurinhas e localização, e tratamento de mensagens editadas ou apagadas pelo cliente.

### Onde foram as seções antigas

Comentários no código e nas migrações citam seções antigas deste documento (por exemplo, "spec.md, Cancelamento"). Elas estão agora em:

| Seção antiga | Arquivo em `docs/features/` |
| --- | --- |
| Usuários e acesso | access.md (regras de acesso e permissões), queue.md (responsável), conversation.md (só o responsável responde) |
| Usuários e acesso › Administração | administration.md; connection.md (telefone e desvincular) |
| Órgãos e contatos | directory.md |
| Órgãos e contatos › Setores e módulos do contato | directory.md |
| Órgãos e contatos › Importar contatos do WhatsApp | contact-import.md |
| Recebimento e distribuição | queue.md |
| Recebimento e distribuição › Notificações | notifications.md |
| Conversa | conversation.md |
| Iniciar conversas | start-conversation.md |
| Transferências (entre atendentes, devolver à fila, entre setores) | transfers.md |
| Formulário de encerramento | closing.md |
| Formulário de encerramento › Assuntos e soluções | subjects.md |
| Encerramento, retorno e correções | closing.md |
| Cancelamento | cancellation.md |
| Dashboard do atendimento | dashboard.md |
| Acessibilidade; Janelas de formulário | interface.md |
| Estrutura e implantação (aviso de número desconectado) | connection.md |
| Recursos previstos para o atendimento | a tabela acima; o "Fora do piloto" ficou aqui |

## Armazenamento

- O sistema armazenará mensagens e anexos durante o piloto. Isso é necessário porque o Whatsmeow não recupera o histórico antigo sob demanda, os links de mídia do WhatsApp expiram e a transferência entre setores exige histórico compartilhado entre números diferentes.
- No piloto não haverá política de exclusão. Retenção e adequação à LGPD serão definidas antes da expansão; o backup será a última etapa a ser resolvida.

## Critérios de validação do piloto

- Conectar o número do setor piloto e receber mensagens no painel.
- Garantir que apenas um atendente consiga assumir um chamado quando houver ações simultâneas.
- Permitir que o mesmo atendente conduza vários chamados sem limite.
- Impedir respostas de usuários que não sejam responsáveis pelo chamado.
- Restringir a visualização ao setor do usuário; o administrador vê todos.
- Buscar contatos cadastrados, iniciar conversas e direcionar para chamados já abertos quando aplicável.
- Receber mensagens de números desconhecidos e exigir o vínculo cadastral antes do encerramento.
- Abrir o formulário ao finalizar e persistir o registro do atendimento.
- Selecionar vários módulos do setor e corrigir horários com auditoria.
- Transferir entre atendentes preservando o histórico.
- Validar a transferência entre setores com número de destino, chamados relacionados e resolução da origem; esse cenário depende de um segundo número de teste ou da expansão do piloto.
- Criar novo chamado quando houver mensagem após encerramento.
- Corrigir atendimentos encerrados com motivo e auditoria, restrito ao responsável e aos supervisores.
- Ignorar mensagens de grupos e registrar mensagens enviadas pelo celular fora do sistema.
- Receber mensagens fora do expediente sem resposta automática.
- Receber e ouvir áudios, enviar áudio gravado e visualizar imagens e vídeos.
- Alertar os supervisores na desconexão do número e reconectar por QR code.
- Assumir pelo painel abre o chamado; ao encerrar, voltar ao painel e ver o atendimento nos realizados do dia.
- Cancelar um chamado de spam sem cadastrar o contato, com motivo e auditoria.
- Devolver um chamado em atendimento à fila.
- Receber arquivo acima do limite como aviso, sem perder a mensagem.
- Preencher o telefone do setor pelo QR code e recusar número já ligado a outro setor.
- Desvincular o número pela tela de conexão e conectar de novo pelo QR code.
- Importar contatos do número do setor sem duplicar os já cadastrados.

## Arquitetura técnica

As decisões técnicas estão em [docs/architecture.md](docs/architecture.md).

## Antes da expansão

- Política de retenção, recuperação e LGPD para mensagens e anexos.
- Revisão dos itens fora do piloto com base no uso real.
- Backup: última etapa a ser resolvida, junto com a decisão final de hospedagem (servidor local ou VPS).
- Reavaliar a publicação por Cloudflare Tunnel e Access: o limite de usuários do plano gratuito diante dos até 120 atendentes e a resposta sobre a LGPD.
- Proteção da branch `main` (T80): depende de plano pago do GitHub e fica para quando houver mais pessoas ou agentes sem acompanhamento no repositório.

Este documento consolida as decisões da conversa.

## Referências

- Whatsmeow: https://github.com/tulir/whatsmeow
- Documentação: https://pkg.go.dev/go.mau.fi/whatsmeow
