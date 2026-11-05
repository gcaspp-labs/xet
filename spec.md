# Plano — Central de atendimento via WhatsApp

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
- Quando o número de um setor desconectar, o sistema avisará os supervisores e administradores no sino de notificações (sem envio de e-mail) e oferecerá uma tela para reconectar por QR code.
- Riscos conhecidos: o celular principal precisa se conectar periodicamente (cerca de 14 dias) para manter os dispositivos vinculados, e iniciar muitas conversas com números novos aumenta o risco de banimento.

## Usuários e acesso

- Cada funcionário terá login individual com e-mail e senha. Não haverá recuperação de senha automática nesta etapa: administradores e supervisores redefinem a senha do usuário quando necessário.
- Na redefinição, quem redefine digita a nova senha e a repassa ao usuário. As sessões abertas do usuário são encerradas.
- A senha precisa ter no mínimo 8 caracteres, com ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial. A LGPD não fixa regra de senha; o guia de segurança da ANPD para agentes de pequeno porte (item 41) recomenda que o sistema exija um nível de complexidade definido pela empresa, e esta é a regra adotada.
- A senha também não pode ser comum ou fácil de adivinhar, como recomenda o NIST SP 800-63B-4. O sistema recusa senhas de uma lista própria de palavras e sequências conhecidas, inclusive com variações de maiúsculas, com números e símbolos no começo ou no fim, ou com letras trocadas por símbolos (`Senha@123`, `P@ssw0rd1!`). A regra vale ao cadastrar e ao redefinir a senha; senhas já gravadas continuam valendo.
- Depois de 5 tentativas de login erradas seguidas com o mesmo e-mail, ou 30 vindas do mesmo IP, o login fica bloqueado por 15 minutos, mesmo com a senha certa. O limite por IP é maior porque um escritório costuma sair por um único IP. Tentativas erradas com mais de 15 minutos deixam de contar, e o login certo zera a contagem do e-mail. E-mail não cadastrado conta da mesma forma, para a resposta não revelar quais e-mails existem.
- Não há botão de desbloqueio: redefinir a senha do usuário libera o e-mail dele na hora.
- A autenticação em dois fatores fica para depois do piloto (T36).
- A sessão expira após 12 horas sem uso; cada acesso renova o prazo. Sair encerra a sessão imediatamente. Sessões expiradas são apagadas periodicamente, mesmo de quem não volta a entrar.
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
- Setores são cadastrados e editados pelo nome. Nesta etapa não há desativação de setor.
- O telefone do setor não é digitado: vem do número lido no QR code ao conectar. Número já ligado a outro setor é recusado: o aparelho é desvinculado e a tela de conexão mostra o motivo. O telefone é apagado quando o número é desvinculado e continua na tela durante quedas temporárias da conexão.
- Os supervisores do setor e os administradores desvinculam o número pela tela de conexão, com confirmação, além de poder desvincular pelo celular. Os chamados abertos continuam no sistema, e as respostas falham até um número ser conectado de novo.
- Ao cadastrar um usuário, o administrador digita a senha inicial, que segue a mesma regra de complexidade da redefinição, e a repassa ao usuário.
- Usuários não são excluídos, apenas desativados; desativar encerra as sessões abertas. O administrador não pode desativar a própria conta nem alterar o próprio papel, para não perder o acesso à administração.
- A desativação ou a troca de setor de um usuário é recusada enquanto ele tiver chamados em atendimento, informando quantos são; os chamados precisam ser transferidos antes.
- A tela de usuários é exclusiva do administrador, que a abre pelo menu Configurações. A redefinição de senha pelo supervisor existe na API, mas ainda não tem tela.

## Órgãos e contatos

- Os clientes atendidos são pessoas físicas, em geral servidores públicos, vinculadas a um órgão.
- Os órgãos são pré-cadastrados por supervisores e administradores, com nome, município e CNPJ opcional (único quando informado). O nome é único dentro do município, sem diferenciar maiúsculas nem acentos; o mesmo nome pode existir em outra cidade. O CNPJ é validado pelos dígitos verificadores e aceita o formato numérico e o alfanumérico emitido pela Receita Federal desde julho de 2026.
- Os municípios são os de São Paulo, com nome e código AUDESP, carregados da lista oficial do TCE-SP. Não têm tela de cadastro.
- Nas listas, buscas e detalhes, o órgão aparece com o município ao lado, porque um nome como "Câmara Municipal" é ambíguo entre cidades.
- Ao cadastrar um órgão, supervisores e administradores podem consultar o CNPJ para sugerir o nome e o município. Quem cadastra confere os dados antes de salvar; se a consulta falhar ou não encontrar o CNPJ, o cadastro manual continua disponível. Município que não está na lista, como o de um órgão de outro estado, fica para escolher à mão. A consulta não salva nada nem guarda outros dados do CNPJ.
- O contato é a pessoa que conversa pelo WhatsApp, com nome e telefone, vinculada a um órgão principal pré-cadastrado. É raro um contato representar mais de um órgão.
- Cada chamado ficará vinculado ao contato e ao órgão. O órgão vem do cadastro do contato e pode ser alterado no formulário de encerramento quando o atendimento for de outro órgão; a alteração vale só para aquele chamado.
- Órgãos são cadastrados manualmente. Contatos são cadastrados manualmente ou importados do WhatsApp do setor. A importação por planilha (CSV) fica para uma etapa posterior.
- Cada telefone corresponde a um único contato. Quando um telefone for usado por mais de uma pessoa, o atendente poderá anotar no chamado com quem falou.
- A busca deverá permitir localizar órgãos e contatos por nome, município, telefone e CNPJ. A busca por nome não diferencia maiúsculas nem acentos ("camara" encontra "Câmara").
- A lista de contatos e a busca de "Nova conversa" filtram também por município e por órgão. O filtro de município mostra só os que têm órgão cadastrado; escolhido o município, o filtro de órgão mostra só os dele.
- Mensagens de números desconhecidos entrarão normalmente na fila.
- A mensagem recebida é ligada ao contato pelo identificador do WhatsApp gravado no contato. Na primeira mensagem de um contato cadastrado manualmente, ainda sem esse identificador, vale o telefone, aceitando também a variante brasileira com ou sem o nono dígito do celular (ex.: 5511987654321 e 551187654321); o identificador passa a ser gravado no contato.
- Número desconhecido gera um contato não cadastrado, com o nome do perfil do WhatsApp ou, sem ele, o telefone. Se o WhatsApp não informar o telefone (contato identificado apenas por LID), o contato fica sem telefone, com o nome do perfil ou "Contato sem telefone"; o atendente informa o telefone ao cadastrá-lo.
- Na conversa de um chamado aberto com contato não cadastrado, um aviso no topo e um botão junto do contato no painel lateral permitem cadastrá-lo sem encerrar. Vale para todos os papéis que podem abrir o chamado, inclusive com ele na fila, sem assumir.
- Nesse cadastro, o órgão é opcional: sem órgão, grava-se só o nome, e o contato continua não cadastrado, com o aviso na conversa. Mensagens recebidas não trocam o nome salvo. Com órgão, vale o cadastro completo.
- Antes de encerrar um chamado de número desconhecido, o atendente deverá cadastrar o contato e vinculá-lo a um órgão pré-cadastrado, mesmo que o nome já tenha sido salvo. O cancelamento dispensa o cadastro.
- Ao cadastrar o contato, os chamados abertos dele que ainda estão sem órgão passam a ter o órgão do cadastro, com registro na auditoria. Chamados que já têm órgão não mudam; a troca continua sendo feita no encerramento.

### Setores e módulos do contato

- O contato pode pertencer a vários setores. O setor organiza a lista e não restringe o acesso: o cadastro continua único para todos os setores.
- No cadastro manual, ao menos um setor é obrigatório, com o setor de quem cadastra já marcado; o administrador escolhe.
- Atendentes e supervisores marcam ou desmarcam apenas o próprio setor e o módulo dele. Os demais setores e módulos do contato aparecem só para leitura e são preservados ao salvar. O administrador altera qualquer setor e módulo.
- A lista de contatos abre em "Meu setor", com opção de ver todos. A busca de "Nova conversa" usa o mesmo filtro. O administrador abre em todos.
- O contato entra no setor sozinho ao escrever para o número dele, ao receber uma conversa iniciada por ele, em mensagem enviada pelo celular do setor ou ao ser transferido para ele.
- O módulo no contato é opcional e o contato tem no máximo um em cada setor: dois setores, até dois módulos. Eles filtram a lista, e o módulo do setor do chamado vem marcado no formulário de encerramento.
- A lista de contatos mostra os setores do contato e o módulo em cada um.
- As alterações de setores e módulos do contato, inclusive as automáticas, ficam registradas na auditoria.

### Importar contatos do WhatsApp

- Todos os papéis importam, pelo número conectado do próprio setor; o administrador escolhe o setor. A importação é sempre uma ação manual, nunca automática ao conectar.
- A lista mostra só quem tem nome salvo na agenda do número e telefone. A pessoa marca os contatos ou usa "selecionar todos".
- A lista indica quem já existe no cadastro, com ou sem o nono dígito. Quem já existe pode ser marcado, para ganhar o vínculo com o setor.
- A busca da lista filtra por nome ou telefone, sem diferenciar maiúsculas nem acentos. "Selecionar todos" vale para os contatos mostrados, e os já marcados continuam marcados ao mudar a busca.
- O órgão é opcional e vale para o lote. Com órgão, o contato fica cadastrado; sem órgão, fica não cadastrado e é completado antes do encerramento.
- Os contatos importados entram no setor do número.
- Telefone que já existe, com ou sem o nono dígito, não é sobrescrito: só ganha o vínculo com o setor. Importar de novo não duplica.

## Recebimento e distribuição

1. Uma nova conversa recebida entra na fila do setor correspondente ao número utilizado.
2. Um atendente assume manualmente o chamado.
3. O sistema registra o responsável e permite que ele conduza a conversa.
4. Outros integrantes autorizados do setor conseguem visualizar o chamado e identificar seu responsável.

Não haverá distribuição automática nem limite de chamados ativos por atendente.

Ao assumir pelo painel, a conversa abre em seguida. Ao assumir pela lista "Conversas do setor" ou pelo sino de notificações, a tela não muda e aparece o aviso "Chamado assumido" com o link "Abrir conversa", sem interromper a conversa atual nem o texto em digitação. A linha inteira do chamado no painel também abre a conversa. Encerrar, transferir para outro setor, cancelar e devolver à fila levam de volta ao painel; a correção continua na mesma tela.

O painel mostra também os **realizados hoje**: todos os atendimentos do setor encerrados no dia, no horário de Brasília e pelo momento real do encerramento, com "Você" nos próprios. Transferidos para outro setor e cancelados aparecem identificados. Cada linha abre o chamado. O administrador vê o setor escolhido no painel.

Fora do expediente, as mensagens entrarão na fila normalmente, sem resposta automática.

Mensagens de grupos do WhatsApp serão ignoradas no piloto e não gerarão chamados. O tratamento de grupos será reavaliado com base no uso real.

Mensagens enviadas diretamente pelo celular do setor, fora do sistema, serão registradas no chamado correspondente com a marcação "enviada fora do sistema", sem atendente identificado. Se não houver chamado aberto para o contato, será criado um chamado na fila do setor. O uso do aparelho para atendimento deve ser evitado.

### Notificações

- O sino do cabeçalho está em todas as telas. Clicar nele abre a lista; o contador soma os chamados na fila e os números desconectados.
- **Chamado na fila:** cada um é um item com o contato, a prévia da última mensagem e os botões "Abrir" e "Assumir". O item existe enquanto o chamado estiver na fila, inclusive devolvido ou transferido, e sai quando alguém assume ou cancela. Não há lido nem histórico.
- Atendentes e supervisores veem a fila do próprio setor; o administrador vê a de todos os setores, com o nome do setor em cada item.
- Ao entrar um chamado na fila, além do contador, aparece um aviso breve, sem botão, para evitar assumir sem querer ao digitar. Abrir a tela ou recuperar a conexão não avisa dos chamados que já estavam na fila.
- **Número desconectado:** item fixo no topo da lista, só para supervisores e administradores, que leva à tela de conexão do setor. Fica até o número conectar, inclusive enquanto a conexão está em andamento e na própria tela de conexão. Enquanto houver número desconectado, o contador fica na cor de alerta.
- **Fora da tela:** quem ativar recebe a notificação do navegador quando a aba está em segundo plano, com o nome do contato e sem o texto da mensagem, e um som curto ao entrar um chamado na fila. O título da aba mostra o contador. Cada pessoa liga ou desliga no menu Configurações, e a escolha fica no navegador. Com tudo fechado, não há aviso.

## Conversa

- Apenas o responsável envia mensagens e arquivos ao cliente, com o chamado aberto; supervisores e administradores também precisam ser o responsável. O backend confere o responsável a cada envio.
- Arquivos enviados pelo painel têm até 16 MB. Imagens JPEG e PNG vão como imagem, vídeos MP4 como vídeo e os demais arquivos como documento, com o nome original. O envio de áudio gravado como mensagem de voz é tratado à parte.
- O responsável grava áudio no próprio painel, pode ouvi-lo ou descartá-lo antes de enviar, e o envia como mensagem de voz do WhatsApp, sem legenda e com até 16 MB. Uma gravação que não pode ser lida como áudio é recusada com aviso para gravar de novo. O navegador só libera o microfone com o painel acessado por HTTPS (ou em `localhost`); fora disso, a tela avisa que a gravação está indisponível.
- Imagens e vídeos, recebidos ou enviados, aparecem com pré-visualização na conversa (a imagem abre em tamanho real numa nova aba) e áudios tocam num player no próprio painel. Os demais arquivos abrem ou são baixados pelo link.
- Arquivos recebidos têm até 100 MB. Arquivo acima do limite, ou que não baixa depois de algumas tentativas, vira mensagem no chamado com o aviso "arquivo não pôde ser baixado". A mensagem não se perde nem fica presa em reentrega.
- Cada mensagem enviada mostra a situação de entrega: enviando, enviada, entregue, lida ou falhou. A situação só avança (uma confirmação atrasada de entrega não desfaz a leitura); uma mensagem marcada como falha volta a avançar se o WhatsApp confirmar a entrega.
- Mensagem que falhou (número desconectado, erro do WhatsApp ou serviço reiniciado durante o envio) não é reenviada automaticamente: o responsável usa "Reenviar", que tenta a mesma mensagem de novo, sem duplicá-la no WhatsApp.
- Notas internas podem ser escritas por qualquer pessoa com acesso ao setor do chamado, mesmo sem ser o responsável e também em chamado encerrado. Não são enviadas ao cliente, nem editadas ou excluídas.
- O campo "falou com" é preenchido pelo responsável enquanto o chamado está aberto; depois do encerramento, muda só pela correção.
- O histórico do contato e o do órgão listam os chamados, abertos e encerrados, dos setores a que o usuário tem acesso (todos, para o administrador), do mais recente ao mais antigo; cada chamado abre a conversa completa, só para leitura quando o usuário não é o responsável.

## Iniciar conversas

- Qualquer atendente poderá buscar um contato e iniciar uma conversa pelo número do próprio setor.
- Ao enviar a primeira mensagem, será criado um chamado atribuído ao atendente.
- Se já existir um chamado aberto para aquele contato no mesmo setor, o sistema direcionará para o chamado existente.
- A existência de um chamado aberto não autoriza outro atendente a responder: permanece necessária a transferência de responsabilidade.
- A primeira mensagem é um texto; arquivos e áudios seguem pela conversa depois de criado o chamado. Ela segue as mesmas regras de envio da conversa: se o número estiver desconectado, o chamado é criado e a mensagem fica com falha, para o responsável reenviar.
- O chamado aberto é verificado ao escolher o contato, antes de escrever a mensagem; se ele surgir enquanto a mensagem é escrita (por exemplo, o cliente mandou mensagem ou outro atendente iniciou ao mesmo tempo), a mensagem não é enviada e o atendente é direcionado ao chamado existente.
- O contato precisa ter telefone. O administrador escolhe por qual setor iniciar a conversa, como no painel.
- Iniciar a conversa já conta como assumir o chamado: fica registrado no histórico, e a conversa começa com "Fulano iniciou a conversa e assumiu o chamado".
- A tela de nova conversa tem um botão para cadastrar o contato ali mesmo; ao salvar, o novo contato já fica escolhido para a primeira mensagem.

## Transferências

### Entre atendentes do mesmo setor

- Transferir a responsabilidade do chamado e preservar mensagens, registros e contexto.
- Registrar a transferência no histórico.
- Transfere o chamado em atendimento o próprio responsável. Supervisores do setor e administradores também transferem chamados de outros atendentes (por exemplo, na ausência do responsável); o atendente que não é o responsável não transfere.
- O destino é um atendente ou supervisor ativo do setor do chamado, diferente do responsável atual. Administradores não são destino. Chamado na fila não é transferido: é assumido.
- A partir da transferência, só o novo responsável responde; o anterior passa a ver a conversa apenas para leitura.
- A conversa mostra, entre as mensagens e na ordem do tempo, quando o chamado foi assumido, cada transferência e o encerramento, com quem fez, de quem para quem e quando.

### Devolver à fila

- O responsável, os supervisores do setor e os administradores devolvem à fila um chamado em atendimento, por exemplo quando foi assumido por engano.
- A devolução fica registrada no histórico e aparece na conversa. O momento em que o chamado foi assumido pela primeira vez não muda.

### Entre setores

- O atendente deverá preencher o formulário de encerramento completo (assunto, resolução e módulos) antes de concluir a transferência.
- A etapa do setor de origem será encerrada.
- Será criado um novo chamado vinculado ao anterior, na fila do setor de destino.
- O setor de destino terá acesso ao histórico relacionado para continuar o atendimento.
- O destino responderá pelo próprio número de WhatsApp.
- A mensagem de abertura pelo número do destino será enviada quando o chamado for assumido, não imediatamente na transferência. O atendente do destino escreve essa mensagem livremente.
- Transfere para outro setor somente o responsável pelo chamado em atendimento, como no encerramento; supervisores e administradores também precisam ser o responsável. Valem as regras do formulário de encerramento, inclusive o cadastro do contato.
- O destino é outro setor ativo. Se o contato já tiver chamado aberto no setor de destino, a transferência é recusada e nada é encerrado.
- O novo chamado entra na fila do destino com o mesmo contato e o órgão informado no formulário, e chega no momento da transferência.
- O chamado do destino mostra a origem (setor, protocolo, assunto, resolução e quem transferiu) com acesso à conversa anterior completa, com notas, só para leitura. Os usuários do destino veem toda a cadeia de chamados anteriores, mas não escrevem notas nem agem neles.
- O chamado de origem mostra para qual setor e protocolo foi transferido, sem acesso à conversa do destino. A conversa da origem mostra quem transferiu e quando.

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

- Encerra o chamado em atendimento somente o responsável; supervisores e administradores também precisam ser o responsável (na ausência dele, o supervisor transfere o chamado para si e encerra). Chamado na fila não é encerrado: é assumido.
- O fim não pode ser anterior ao início nem estar no futuro. Sem edição, o fim é o momento em que o formulário é salvo.
- O órgão sugerido é o do chamado ou, se ele ainda não tiver, o órgão principal do contato. Contato não cadastrado (número desconhecido) precisa ser cadastrado e vinculado a um órgão antes de salvar o formulário.
- Os módulos selecionáveis são os ativos do setor do chamado. O módulo do contato nesse setor, se estiver ativo, já vem marcado, e a pessoa pode alterar ou marcar outros para aquele chamado.

Cada setor terá sua própria lista de módulos/sistemas. Um chamado poderá tratar de vários módulos, com uma resolução geral.

O momento em que o chamado foi assumido é registrado separadamente, permitindo medir o tempo de espera na fila.

Alterações nos horários deverão ficar registradas no histórico de auditoria. O intervalo entre início e fim representa o tempo decorrido do atendimento; como há atendimentos simultâneos, ele não representa necessariamente trabalho exclusivo naquele cliente.

## Encerramento, retorno e correções

- Uma mensagem recebida após o encerramento criará um novo chamado, preservando os anteriores no histórico.
- Chamados encerrados não poderão ser reabertos nesta etapa.
- Os dados de um atendimento encerrado poderão ser corrigidos pelo atendente que o encerrou e pelos supervisores e administradores do setor. Os demais atendentes do setor não corrigem.
- A correção altera os dados do formulário de encerramento (assunto, resolução, módulos, órgão, início e fim) e o "falou com". Valem as mesmas regras do encerramento: assunto, resolução e ao menos um módulo obrigatórios, órgão cadastrado, fim depois do início e não no futuro.
- Módulos que já estavam no chamado podem continuar nele mesmo que tenham sido desativados depois do encerramento; módulos acrescentados na correção precisam estar ativos no setor.
- Correções exigirão um motivo. Uma correção que não altera nenhum dado é recusada, sem registro.
- O sistema registrará autor, data, motivo e alterações realizadas (valores anteriores e novos). O chamado mostra o histórico de alterações nos detalhes, e a conversa mostra, na ordem do tempo, quem corrigiu o atendimento e quando.

## Cancelamento

- Cancelar finaliza o chamado sem lançar o atendimento, para spam, golpes e engano. Dispensa o formulário de encerramento, o cadastro do contato e o órgão.
- Na fila, qualquer pessoa do setor cancela, sem assumir. Em atendimento, cancelam o responsável, os supervisores do setor e os administradores.
- O motivo é um texto livre obrigatório. A conversa mostra quem cancelou, quando e o motivo.
- O chamado cancelado fica no histórico, identificado como cancelado, e não é corrigido nem reaberto. Notas internas continuam permitidas.
- Uma nova mensagem do mesmo número abre outro chamado, como após um encerramento.

## Dashboard do atendimento

Mostra a situação e o desempenho do atendimento, com filtros. Só leitura.

- **Quem vê:** o administrador vê todos os setores e o supervisor, só o próprio. O atendente não vê: não tem o item no menu, e a API recusa.
- **Filtros:** período (hoje, 7 dias, 30 dias ou datas à escolha), setor (só para o administrador), atendente, módulo e órgão. Abre em "Hoje" e, para o administrador, em todos os setores. "7 dias" e "30 dias" contam o dia de hoje. Os dias seguem o horário de Brasília.
- Atendente e módulo pertencem a um setor: para o administrador, ficam desabilitados até ele escolher um setor, e trocar de setor limpa os dois.
- Os números refletem os dados atuais do chamado, inclusive depois de uma correção.

| Número | Conta | Data que entra no período |
| --- | --- | --- |
| Na fila | Chamados na fila agora | Não muda com o período |
| Em atendimento | Chamados em atendimento agora | Não muda com o período |
| Recebidos | Chamados vindos do cliente ou de transferência de outro setor | Chegada |
| Iniciados | Chamados iniciados pela equipe, no sistema ou pelo celular do setor | Chegada |
| Encerrados | Encerramentos pelo formulário | Momento real do encerramento |
| Transferidos | Transferências para outro setor; a troca de atendente não conta, porque o chamado continua aberto | Momento real do encerramento |
| Cancelados | Cancelamentos | Momento real do encerramento |
| Tempo médio de espera | Da chegada até a primeira vez que alguém assumiu, nos chamados recebidos | Momento em que foi assumido |
| Tempo médio de atendimento | De quando foi assumido até o "Fim" do formulário, em encerrados e transferidos | Momento real do encerramento |

- Na visão de todos os setores, uma transferência conta como transferido na origem e recebido no destino. Um chamado recebido do cliente e depois transferido soma dois recebidos, um em cada setor.
- A espera conta só a primeira vez na fila de cada chamado: o tempo depois de devolver à fila não entra. O chamado transferido tem a espera contada no destino, a partir da transferência. Se a chegada for posterior ao momento em que foi assumido, por causa do relógio de quem enviou a mensagem, a espera conta como zero.
- O tempo de atendimento ignora o "Início" editado no formulário, mas respeita o "Fim" editado. Se o "Fim" for anterior ao momento em que o chamado foi assumido, o chamado fica fora da média. Cancelados também ficam fora. Como há atendimentos simultâneos, esse tempo não representa trabalho exclusivo naquele cliente.
- Sem chamados para calcular, a média aparece como "—".

Cada filtro vale só para os números em que faz sentido. Nos demais, com aquele filtro ativo, aparece "—" com a indicação "Não se aplica ao filtro", em vez de um número que pareceria filtrado:

| Número | Setor | Atendente | Módulo | Órgão |
| --- | --- | --- | --- | --- |
| Na fila | Sim | Não se aplica | Não se aplica | Sim |
| Em atendimento | Sim | Responsável atual | Não se aplica | Sim |
| Recebidos | Sim | Não se aplica | Não se aplica | Sim |
| Iniciados | Sim | Quem iniciou no sistema | Não se aplica | Sim |
| Encerrados | Sim | Responsável | Sim | Sim |
| Transferidos | Sim | Responsável | Sim | Sim |
| Cancelados | Sim | Responsável | Não se aplica | Sim |
| Tempo médio de espera | Sim | Não se aplica | Não se aplica | Sim |
| Tempo médio de atendimento | Sim | Responsável | Sim | Sim |

- O filtro de órgão usa o órgão atual do chamado: chamados sem órgão ficam de fora. Um chamado com vários módulos conta uma vez em cada módulo.
- **Tabela por atendente:** nome, em atendimento, iniciados, encerrados, transferidos, cancelados e tempo médio de atendimento, com as mesmas regras e filtros dos números acima. Lista só quem tem algum número diferente de zero. Na visão de todos os setores, cada linha é uma pessoa em um setor e mostra o setor.
- O atendimento é atribuído ao responsável final do chamado, mesmo que ele tenha passado por outras pessoas ou que outra pessoa o tenha cancelado.
- Os números se atualizam sozinhos quando um chamado muda, sem recarregar a tela.

## Acessibilidade

- No menu Configurações, cada pessoa escolhe o tamanho do texto (Padrão, Grande ou Maior) e liga o alto contraste, que vale com o tema claro e com o escuro. A escolha fica no navegador, como o tema.
- O alvo é atender pessoas com baixa visão. O sistema não declara conformidade com a ABNT NBR 17225.

## Janelas de formulário

Formulários e consultas que abrem por cima da tela aparecem em uma janela no centro. O painel fixo da conversa (Detalhes, Notas e Histórico) continua onde está.

- **Com bloqueio:** encerrar, transferir para atendente ou setor, devolver à fila, cancelar chamado, corrigir atendimento, nova conversa e o cadastro de contato aberto durante um atendimento ou pela nova conversa. Não há X, e Esc ou clique fora não fecham: a saída é concluir ou usar o botão Cancelar/Voltar.
- **Com fechamento normal:** usuários, setores, módulos, órgãos, contatos e importação pelo menu, desvincular número e histórico. X, Esc e clique fora fecham.
- Cancelar o cadastro de contato volta à janela de onde ele foi aberto, sem perder o que já estava nela.

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
- Cancelamento de atendimento e lista de atendimentos realizados no dia.
- Importação de contatos do WhatsApp do setor.
- Dashboard do atendimento, com resumo e filtros, para supervisores e administradores.

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
- Assumir pelo painel abre a conversa; ao encerrar, voltar ao painel e ver o atendimento nos realizados do dia.
- Cancelar um chamado de spam sem cadastrar o contato, com motivo e auditoria.
- Devolver um chamado em atendimento à fila.
- Receber arquivo acima do limite como aviso, sem perder a mensagem.
- Preencher o telefone do setor pelo QR code e recusar número já ligado a outro setor.
- Desvincular o número pela tela de conexão e conectar de novo pelo QR code.
- Importar contatos do número do setor sem duplicar os já cadastrados.

## Arquitetura técnica

As decisões técnicas estão em [arquitetura.md](arquitetura.md).

## Antes da expansão

- Política de retenção, recuperação e LGPD para mensagens e anexos.
- Revisão dos itens fora do piloto com base no uso real.
- Backup: última etapa a ser resolvida, junto com a decisão final de hospedagem (servidor local ou VPS).
- Reavaliar a publicação por Cloudflare Tunnel e Access: o limite de usuários do plano gratuito diante dos até 120 atendentes e a resposta sobre a LGPD.
- Proteção da branch `main` (T35): depende de plano pago do GitHub e fica para quando houver mais pessoas ou agentes sem acompanhamento no repositório.

Este documento consolida as decisões da conversa.

## Referências

- Whatsmeow: https://github.com/tulir/whatsmeow
- Documentação: https://pkg.go.dev/go.mau.fi/whatsmeow
