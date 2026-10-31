# Plano — Central de atendimento via WhatsApp

## Objetivo

Criar um sistema próprio de atendimento para substituir a operação compartilhada pelo WhatsApp Web, com identificação dos atendentes, filas, responsáveis, transferências, histórico e registro formal ao finalizar cada atendimento.

Nesta etapa, todos os registros ficarão no novo sistema. Não haverá integração nem lançamento automático no sistema legado.

## Estrutura e implantação

- A empresa possui seis setores: Contabilidade, Suprimentos, Tributos, RH, GED e Social.
- Setores serão cadastrados livremente no sistema, cada um com seu número de WhatsApp. No início, apenas a Contabilidade será cadastrada.
- Hoje há até quatro atendentes por setor. A solução deverá contemplar expansão para até 20 por setor, totalizando 120 atendentes.
- O piloto será feito no setor de Contabilidade.
- A conexão inicial será feita com Whatsmeow, biblioteca em Go que utiliza o protocolo do WhatsApp Web.
- O sistema será hospedado inicialmente em servidor da própria empresa, podendo migrar para uma VPS. A implantação não deve depender de recursos específicos do servidor local, para que a migração seja simples. Em servidor local, a disponibilidade depende da internet e da energia do escritório, e o acesso externo, se necessário, exigirá publicação segura (HTTPS).
- O Whatsmeow é uma conexão não oficial; a operação precisa considerar manutenção da integração e possíveis desconexões. A camada de conexão deve permitir uma futura substituição sem alterar os registros de atendimento.
- Quando o número de um setor desconectar, o sistema avisará os supervisores no painel (sem envio de e-mail) e oferecerá uma tela para reconectar por QR code.
- Riscos conhecidos: o celular principal precisa se conectar periodicamente (cerca de 14 dias) para manter os dispositivos vinculados, e iniciar muitas conversas com números novos aumenta o risco de banimento.

## Usuários e acesso

- Cada funcionário terá login individual com e-mail e senha. Não haverá recuperação de senha automática nesta etapa: administradores e supervisores redefinem a senha do usuário quando necessário.
- Na redefinição, quem redefine digita a nova senha e a repassa ao usuário. As sessões abertas do usuário são encerradas.
- A senha precisa ter no mínimo 8 caracteres, com ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial. A LGPD não fixa regra de senha; o guia de segurança da ANPD para agentes de pequeno porte (item 41) recomenda que o sistema exija um nível de complexidade definido pela empresa, e esta é a regra adotada.
- A sessão expira após 12 horas sem uso; cada acesso renova o prazo. Sair encerra a sessão imediatamente.
- Cada usuário pertence a um único setor, como atendente ou supervisor, e visualiza apenas as filas e os atendimentos do próprio setor.
- O administrador funciona como supervisor global: acessa todos os setores, além da administração do sistema.
- A tabela completa de permissões está em [modelo-dados.md](modelo-dados.md).
- Cada chamado terá um único responsável por vez.
- Apenas o responsável poderá responder ao cliente; outro atendente precisará receber o chamado por transferência.
- Um atendente poderá assumir vários chamados simultaneamente, sem limite.
- O painel mostrará a quantidade de chamados ativos de cada atendente, sem impedir novas atribuições.

### Administração

- O administrador geral cadastra usuários, setores e permissões.
- O supervisor gerencia a lista de módulos/sistemas do próprio setor. As listas serão cadastradas no sistema, sem necessidade de defini-las antes da implementação.
- Setores são cadastrados e editados (nome e número). Nesta etapa não há desativação de setor.
- Ao cadastrar um usuário, o administrador digita a senha inicial, que segue a mesma regra de complexidade da redefinição, e a repassa ao usuário.
- Usuários não são excluídos, apenas desativados; desativar encerra as sessões abertas. O administrador não pode desativar a própria conta nem alterar o próprio papel, para não perder o acesso à administração.
- A tela de usuários é exclusiva do administrador. A redefinição de senha pelo supervisor existe na API, mas ainda não tem tela.

## Órgãos e contatos

- Os clientes atendidos são pessoas físicas, em geral servidores públicos, vinculadas a um órgão.
- Os órgãos são pré-cadastrados por supervisores e administradores, com nome e CNPJ opcional (único quando informado).
- O contato é a pessoa que conversa pelo WhatsApp, com nome e telefone, vinculada a um órgão principal pré-cadastrado. É raro um contato representar mais de um órgão.
- Cada chamado ficará vinculado ao contato e ao órgão. O órgão vem do cadastro do contato e pode ser alterado no formulário de encerramento quando o atendimento for de outro órgão; a alteração vale só para aquele chamado.
- No piloto, órgãos e contatos serão cadastrados manualmente. A importação por planilha (CSV) fica para uma etapa posterior.
- Cada telefone corresponde a um único contato. Quando um telefone for usado por mais de uma pessoa, o atendente poderá anotar no chamado com quem falou.
- A busca deverá permitir localizar órgãos e contatos por nome, telefone e CNPJ.
- Mensagens de números desconhecidos entrarão normalmente na fila.
- Antes de finalizar um chamado de número desconhecido, o atendente deverá cadastrar o contato e vinculá-lo a um órgão pré-cadastrado.

## Recebimento e distribuição

1. Uma nova conversa recebida entra na fila do setor correspondente ao número utilizado.
2. Um atendente assume manualmente o chamado.
3. O sistema registra o responsável e permite que ele conduza a conversa.
4. Outros integrantes autorizados do setor conseguem visualizar o chamado e identificar seu responsável.

Não haverá distribuição automática nem limite de chamados ativos por atendente.

Fora do expediente, as mensagens entrarão na fila normalmente, sem resposta automática.

Mensagens de grupos do WhatsApp serão ignoradas no piloto e não gerarão chamados. O tratamento de grupos será reavaliado com base no uso real.

Mensagens enviadas diretamente pelo celular do setor, fora do sistema, serão registradas no chamado correspondente com a marcação "enviada fora do sistema", sem atendente identificado. Se não houver chamado aberto para o contato, será criado um chamado na fila do setor. O uso do aparelho para atendimento deve ser evitado.

## Iniciar conversas

- Qualquer atendente poderá buscar um contato e iniciar uma conversa pelo número do próprio setor.
- Ao enviar a primeira mensagem, será criado um chamado atribuído ao atendente.
- Se já existir um chamado aberto para aquele contato no mesmo setor, o sistema direcionará para o chamado existente.
- A existência de um chamado aberto não autoriza outro atendente a responder: permanece necessária a transferência de responsabilidade.

## Transferências

### Entre atendentes do mesmo setor

- Transferir a responsabilidade do chamado e preservar mensagens, registros e contexto.
- Registrar a transferência no histórico.

### Entre setores

- O atendente deverá preencher o formulário de encerramento completo (assunto, resolução e módulos) antes de concluir a transferência.
- A etapa do setor de origem será encerrada.
- Será criado um novo chamado vinculado ao anterior, na fila do setor de destino.
- O setor de destino terá acesso ao histórico relacionado para continuar o atendimento.
- O destino responderá pelo próprio número de WhatsApp.
- A mensagem de abertura pelo número do destino será enviada quando o chamado for assumido, não imediatamente na transferência. O atendente do destino escreve essa mensagem livremente.

## Formulário de encerramento

Ao clicar em finalizar, o sistema abrirá o formulário de registro. O chamado somente será encerrado após salvar os dados necessários.

| Campo | Comportamento |
| --- | --- |
| Assunto | Preenchido pelo atendente; obrigatório |
| Resolução | Preenchida pelo atendente; obrigatória |
| Módulos/sistemas | Seleção de um ou mais módulos atendidos pelo setor; ao menos um obrigatório |
| Contato | Automático |
| Órgão | Automático, com base no órgão principal do contato; editável |
| Atendente | Automático, com base no responsável |
| Setor | Automático |
| Início | Automático: chegada da primeira mensagem do cliente ou, em conversa iniciada pelo atendente, envio da primeira mensagem; editável |
| Fim | Preenchido automaticamente e editável |

Cada setor terá sua própria lista de módulos/sistemas. Um chamado poderá tratar de vários módulos, com uma resolução geral.

O momento em que o chamado foi assumido é registrado separadamente, permitindo medir o tempo de espera na fila.

Alterações nos horários deverão ficar registradas no histórico de auditoria. O intervalo entre início e fim representa o tempo decorrido do atendimento; como há atendimentos simultâneos, ele não representa necessariamente trabalho exclusivo naquele cliente.

## Encerramento, retorno e correções

- Uma mensagem recebida após o encerramento criará um novo chamado, preservando os anteriores no histórico.
- Chamados encerrados não poderão ser reabertos nesta etapa.
- Os dados de um atendimento encerrado poderão ser corrigidos pelo atendente que o encerrou e pelos supervisores e administradores do setor.
- Correções exigirão um motivo.
- O sistema registrará autor, data, motivo e alterações realizadas.

## Armazenamento

- O sistema armazenará mensagens e anexos durante o piloto. Isso é necessário porque o Whatsmeow não recupera o histórico antigo sob demanda, os links de mídia do WhatsApp expiram e a transferência entre setores exige histórico compartilhado entre números diferentes.
- No piloto não haverá política de exclusão. Retenção e adequação à LGPD serão definidas antes da expansão; o backup será a última etapa a ser resolvida.

## Recursos previstos para o atendimento

- Painel de conversas com filas e responsáveis.
- Protocolo por chamado no formato ano + sequência (ex.: 2026-000123), visível apenas para a equipe.
- Histórico por órgão e contato.
- Envio e recebimento de texto e arquivos; áudios com player no painel e envio de áudio gravado; pré-visualização de imagens e vídeos.
- Notas internas no chamado, visíveis somente à equipe autorizada do setor.
- Busca de clientes e abertura de conversas pela equipe.
- Transferências entre atendentes e setores.
- Formulário de encerramento e histórico de alterações.

Fora do piloto: etiquetas, importação por planilha, grupos, exibição de reações, figurinhas e localização, e tratamento de mensagens editadas ou apagadas pelo cliente. Mensagens de tipos não suportados aparecerão no histórico como aviso ("tipo de mensagem não suportado"), sem se perder silenciosamente.

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

## Arquitetura técnica

As decisões técnicas estão em [arquitetura.md](arquitetura.md).

## Antes da expansão

- Política de retenção, recuperação e LGPD para mensagens e anexos.
- Revisão dos itens fora do piloto com base no uso real.
- Backup: última etapa a ser resolvida, junto com a decisão final de hospedagem (servidor local ou VPS).

Este documento consolida as decisões da conversa.

## Referências

- Whatsmeow: https://github.com/tulir/whatsmeow
- Documentação: https://pkg.go.dev/go.mau.fi/whatsmeow
