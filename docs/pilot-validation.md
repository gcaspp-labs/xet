# Validação do piloto

Acompanha a [T79](https://github.com/gcaspp-labs/xet/issues/79), antiga T34. Cruza cada critério de validação da `spec.md` com os testes automatizados e com o que ainda precisa do servidor e do número real da Contabilidade.

A T79 só termina quando a última coluna da matriz estiver toda como **Atendido**. Até lá, a issue fica aberta, com o rótulo `in-progress`.

## Situação

- **Testes automatizados:** todos os critérios têm cobertura, com o WhatsApp simulado pelo adaptador falso.
- **Imagens e Compose:** testados na máquina de desenvolvimento, em 2026-11-02 com HTTPS local do Caddy e em 2026-11-04 no caminho do túnel, sem token real. Ver "Teste da implantação".
- **Publicação:** Cloudflare Tunnel e Access em `https://atendimento.gcaspp.com.br`, sem porta aberta no servidor. O código está pronto; a configuração na Cloudflare, no Registro.br e no servidor ainda não foi feita. Ver "Roteiro de implantação".
- **Servidor:** servidor da empresa, ainda não preparado.
- **Número real:** nenhum critério foi validado de ponta a ponta com o número da Contabilidade.

## Matriz dos critérios

Legenda da última coluna: **Automatizado** tem teste passando e falta conferir no servidor; **Pendente** depende do número real para valer como validado, porque a parte do WhatsApp não é coberta pelo adaptador falso.

| # | Critério | Integração | Ponta a ponta | Com o número real | Situação |
| --- | --- | --- | --- | --- | --- |
| 1 | Conectar o número do setor piloto e receber mensagens no painel | `TestReceiveFromUnknownNumberOpensQueuedTicket` | `connection.spec`, `panel.spec` | Ler o QR code; mensagem chega sem recarregar | Pendente |
| 2 | Apenas um atendente assume em ações simultâneas | `TestOnlyOneAgentAssignsConcurrently` | `panel.spec` | Não depende | Automatizado |
| 3 | Mesmo atendente conduz vários chamados sem limite | `TestSameAgentHoldsManyTicketsWithoutLimit` | `panel.spec` | Não depende | Automatizado |
| 4 | Impedir respostas de quem não é responsável | `TestOnlyTheAssigneeReplies` | `conversation.spec` | Não depende | Automatizado |
| 5 | Visualização restrita ao setor; administrador vê todos | `TestSectorListIsLimitedToOwnSector`, `TestEventsReachOnlyTheSectorUsers` | `panel.spec`, `directory.spec` | Não depende | Automatizado |
| 6 | Buscar contatos, iniciar conversas e direcionar a chamados abertos | `TestDirectorySearch`, `TestStartConversationDirectsToTheOpenTicket` | `start-conversation.spec` | Primeira mensagem chega ao celular | Pendente |
| 7 | Número desconhecido exige vínculo cadastral antes do encerramento | `TestUnknownNumberMustBeRegisteredBeforeClosing` | `closing.spec` | Não depende | Automatizado |
| 8 | Formulário ao finalizar e registro persistido | `TestCloseRecordsTheClosingForm` | `closing.spec` | Não depende | Automatizado |
| 9 | Vários módulos do setor e correção de horários com auditoria | `TestCorrectionRecordsAuthorReasonAndChanges` | `closing.spec`, `correction.spec` | Não depende | Automatizado |
| 10 | Transferir entre atendentes preservando o histórico | `TestTransferMovesTheReplyToTheNewAssignee` | `transfer.spec` | Não depende | Automatizado |
| 11 | Transferência entre setores com número de destino, chamados relacionados e resolução da origem | `TestTransferBetweenSectorsClosesOriginAndQueuesLinkedTicket` | `transfer-sector.spec` | Precisa de um segundo número: a primeira mensagem do destino chega pelo número dele | Pendente |
| 12 | Novo chamado quando há mensagem após o encerramento | `TestMessageAfterClosingByTheFormOpensNewTicket` | Sem teste próprio | Não depende | Automatizado |
| 13 | Corrigir encerrados com motivo e auditoria, só responsável e supervisores | `TestOnlyWhoClosedAndSupervisionCorrect`, `TestCorrectionWithoutReasonIsRefused` | `correction.spec` | Não depende | Automatizado |
| 14 | Ignorar grupos e registrar mensagens enviadas pelo celular | `TestGroupMessagesAreIgnored`, `TestMessagesSentFromThePhone` | Sem teste próprio | Mensagem em grupo não aparece; resposta pelo celular aparece no chamado | Pendente |
| 15 | Mensagens fora do expediente sem resposta automática | `TestMessageOutsideOfficeHoursGetsNoAutomaticReply` | Sem teste próprio | Não depende | Automatizado |
| 16 | Receber e ouvir áudios, enviar áudio gravado, ver imagens e vídeos | `TestMediaIsSavedOnArrival`, `TestRecordedAudioGoesAsVoiceMessage` | `media.spec` | Gravação no servidor com HTTPS; voz chega ao celular com a duração certa; mídias do celular abrem no painel | Pendente |
| 17 | Alertar supervisores na desconexão e reconectar por QR code | `TestDisconnectionReachesSupervisors`, `TestConnectionSurvivesRestart` | `connection.spec` | Ver "Teste de reconexão" | Pendente |
| 18 | Assumir abre o chamado; encerrar volta a Chamados e o atendimento entra no histórico de Atendimentos | `TestClosedTicketsListWhatTheSectorClosed` | `atendimentos.spec`, `closing.spec` | Não depende | Automatizado |
| 19 | Cancelar spam sem cadastrar o contato, com motivo e auditoria | `TestCancelFromTheQueueWithoutAssigning`, `TestCancelRequiresReason` | `closing.spec` | Não depende | Automatizado |
| 20 | Devolver chamado em atendimento à fila | `TestReturnToQueueAndSomeoneElseAssigns` | `return.spec` | Não depende | Automatizado |
| 21 | Arquivo acima do limite vira aviso, sem perder a mensagem | `TestUnavailableMediaBecomesNotice` | `media.spec` | Enviar arquivo acima de 100 MB | Pendente |
| 22 | Telefone do setor pelo QR code e recusa de número de outro setor | `TestPhoneFollowsTheConnection` | `connection.spec` | Telefone preenchido; celular mostra "Central de Atendimento"; recusa precisa de um segundo setor | Pendente |
| 23 | Desvincular pela tela e conectar de novo por QR code | `TestDisconnectFromTheScreen` | `connection.spec` | Aparelho some do celular; novo QR funciona | Pendente |
| 24 | Importar contatos do número sem duplicar | `TestImportContacts`, `TestImportKeepsExistingContact` | `directory.spec` | `SavedContacts` do Whatsmeow nunca foi executado com número real | Pendente |

## Teste da implantação

### Caminho do túnel, sem token real (2026-11-04)

Executado com `deploy/compose.yml`, num projeto isolado, com `SITE_ADDRESS=:80`, `COOKIE_SECURE=true` e um token falso. Os logins partiram de um contêiner na rede do Compose, direto para `http://web:80`, simulando o `cloudflared`.

| Verificação | Resultado |
| --- | --- |
| `make up` com `CLOUDFLARE_TUNNEL_TOKEN` vazio ou ausente termina com erro e não cria contêiner | OK |
| Nenhum serviço publica porta no servidor, inclusive `web` | OK |
| `/health` responde 200 pelo Caddy, em HTTP, na rede interna | OK |
| `cloudflared` sobe com a imagem fixada e recusa o token falso (`Provided Tunnel token is not valid`) | OK |
| Login errado com `CF-Connecting-IP: 203.0.113.10`, duas vezes: `login_attempts` grava esse IP com 2 falhas | OK |
| Login errado com outro valor (`198.51.100.20`): conta separado, com 1 falha | OK |
| IPv6 em `CF-Connecting-IP` (`2001:db8::7`): gravado como enviado | OK |
| `X-Forwarded-For` forjado (`192.0.2.99`) junto de `CF-Connecting-IP: 192.0.2.30`: só o segundo é gravado | OK |

### Verificação manual no servidor, a fazer na T79

| Verificação | Resultado |
| --- | --- |
| Login em `https://atendimento.gcaspp.com.br` | Pendente |
| Cookie de sessão sai com `Secure` | Pendente |
| WebSocket pelo túnel: mensagem nova aparece sem recarregar a página | Pendente |
| Envio de arquivo de 16 MB | Pendente |
| Acesso de casa pede o código por e-mail; e-mail fora da equipe não recebe acesso | Pendente |
| Acesso do escritório entra sem o código | Pendente |
| Limite de login: `login_attempts` grava o IP real de quem acessou, não o do `cloudflared` | Pendente |
| Comportamento do WebSocket ao expirar a sessão do Access: anotar aqui o que acontece | Pendente |

### Com HTTPS local do Caddy (2026-11-02)

Executado com `deploy/compose.yml`, num projeto isolado, com `SITE_ADDRESS=localhost`, `COOKIE_SECURE=true` e as portas 80 e 443 publicadas, que o Compose não publica mais.

| Verificação | Resultado |
| --- | --- |
| Imagens de backend e interface são construídas; migrações rodam ao subir | OK |
| HTTP redireciona para HTTPS; interface abre em rota interna por HTTP/2 | OK |
| `/health` responde 200 pelo proxy | OK |
| Rotas `/api/test/*` do adaptador falso respondem 404 | OK |
| `create-admin` lê a senha da entrada padrão; login funciona | OK |
| Cookie de sessão sai com `HttpOnly`, `Secure` e `SameSite=Lax` | OK |
| WebSocket pelo proxy: 101 com sessão, 401 sem sessão | OK |
| Banco e backend sem porta publicada no servidor | OK |
| Volume de mídia gravável pelo usuário `app`; ffmpeg com libopus na imagem | OK |
| Sessão e certificado permanecem depois de `restart` e de `down` seguido de `up` | OK |
| Whatsmeow real abre conexão a partir do contêiner e devolve QR code em PNG (sem leitura) | OK |

Fora destes testes: certificado público real, sinal de internet instável e carga.

## Roteiro de implantação

### Cloudflare e Registro.br

1. Criar a conta da Cloudflare com dois fatores e adicionar `gcaspp.com.br`, no plano gratuito. Esse plano exige mover o DNS do domínio inteiro para a Cloudflare.
2. **Lembrete:** antes de trocar os nameservers, conferir no painel da Cloudflare os registros de e-mail abaixo. Se faltar algum, o e-mail da empresa para de funcionar depois da troca. Valores conferidos no DNS público em 2026-11-02 e de novo em 2026-11-04:
   - MX `1 aspmx.l.google.com`
   - MX `5 alt1.aspmx.l.google.com`
   - MX `5 alt2.aspmx.l.google.com`
   - MX `10 aspmx2.googlemail.com`
   - MX `10 aspmx3.googlemail.com`
   - TXT `v=spf1 include:_spf.google.com ~all`

   Nameservers atuais: `nsa1` a `nsa6.hostnet.com.br`. O site atual não está em uso (responde erro 500) e não precisa ser preservado.
3. Trocar os nameservers no Registro.br pelos que a Cloudflare indicar e esperar o painel dela mostrar o domínio como ativo. **Lembrete:** depois da troca, testar enviar e receber e-mail.
4. Criar o túnel, com `atendimento.gcaspp.com.br` apontando para `http://web:80`, sem reescrever o `Host`, porque o WebSocket confere a origem. Guardar o token do túnel para o passo 10. Ele dá acesso ao túnel: não colocar no repositório nem em mensagens.
5. Ativar "Always Use HTTPS" e criar uma regra para não fazer cache de `/api/*`.
6. Criar a aplicação no Cloudflare Access para `atendimento.gcaspp.com.br`, com duas regras: liberar o IP do escritório e, para os demais, código por e-mail só para os e-mails da equipe. Com o IP alterado, o escritório passa a pedir o código, sem ficar sem acesso. Antes, confirmar com o provedor que o IP é fixo e conferir o limite de usuários do plano gratuito.
7. Só usar dados reais depois da avaliação de LGPD (`spec.md`, "Estrutura e implantação"): a Cloudflare vê o tráfego aberto, inclusive conversas e senhas.

### Servidor

8. Instalar Docker com o plugin Compose e clonar o repositório. Não é preciso abrir porta de entrada: o túnel só faz conexão de saída.
9. Copiar `deploy/.env.example` para `deploy/.env`.
10. Em `deploy/.env`, definir `POSTGRES_PASSWORD` só com letras e números e colar o token do passo 4 em `CLOUDFLARE_TUNNEL_TOKEN`. Manter `SITE_ADDRESS=:80` e `COOKIE_SECURE=true`.
11. Subir com `make up` e acompanhar com `make logs`. Sem o token, o `make up` recusa subir. O túnel deve aparecer como ativo no painel da Cloudflare.
12. Criar o administrador com `make create-admin NAME="Nome" EMAIL=email`.
13. Fazer a "Verificação manual no servidor", em "Teste da implantação". Nela se confirma o que as páginas da Cloudflare não informam, como o suporte a WebSocket.
14. Cadastrar a Contabilidade, o supervisor e os atendentes pela interface.
15. Conectar o número em Conexão, lendo o QR code.
16. Percorrer os critérios **Pendente** da matriz e atualizar a última coluna.

Backup continua sem definição: é a última etapa, junto com a decisão de hospedagem (`spec.md`, "Antes da expansão"). Antes de atender clientes reais, confirmar se o piloto pode rodar sem ele.

## Teste de reconexão

Só pode ser feito no servidor, com o número real conectado. Em cada caso, conferir também que nenhuma mensagem se perdeu nem duplicou.

| Caso | Como provocar | O que precisa acontecer |
| --- | --- | --- |
| Queda de internet | Tirar o servidor da rede por alguns minutos, enviar mensagens do celular do cliente nesse intervalo e religar | Supervisor é avisado se a queda for detectada; ao voltar, a conexão retorna sem QR code e as mensagens do intervalo chegam |
| Reinício do serviço | `docker compose -f deploy/compose.yml --env-file deploy/.env restart backend` | Número volta conectado sem QR code; mensagens `pending` viram `failed`, sem reenvio automático |
| Reinício do servidor | Reiniciar a máquina | Contêineres sobem sozinhos; número volta conectado sem QR code |
| Desconexão pelo celular | Remover o aparelho vinculado no celular | Setor fica como "Requer QR code"; supervisor é avisado; novo QR code reconecta |
| Celular desligado | Desligar o celular por alguns minutos e enviar mensagens pelo painel | Conexão continua, porque o aparelho vinculado não depende do celular ligado |

Há uma suspeita anotada no PR da T26, lida no código e não reproduzida: a conta é gravada sem o número do dispositivo (`ToNonAD`), e o reinício pode cair em `logged_out`, perdendo o telefone. O caso "Reinício do serviço" é quem confirma ou descarta. Testar isso primeiro.

## Conferências manuais somadas das tasks anteriores

O "Pronto quando" destas tasks depende do número real, e os testes foram adiados para serem feitos juntos.

- **T06:** reiniciar e ver o número voltar sem QR code; desvincular pelo celular e ver "Requer QR code".
- **T08:** mensagem real chega ao painel sem recarregar; o QR code troca sozinho a cada 20 segundos, aproximadamente.
- **T09:** responder texto, imagem e PDF; status "Entregue" e "Lida" pelos recibos; desconectar, enviar (vira "Falhou"), reconectar e reenviar sem duplicar no celular.
- **T10:** gravar áudio e ver chegar como mensagem de voz; receber áudio, imagem e vídeo do celular.
- **T15:** com um segundo número, transferir da Contabilidade e ver a primeira mensagem do destino chegar pelo número dele.
- **T24:** enviar arquivo acima de 100 MB e ver o aviso com a legenda ou o nome do arquivo.
- **T26:** QR code mostra "Central de Atendimento" no celular; telefone preenchido; "Desvincular número" remove o aparelho; recusa de número ligado a outro setor.
- **T29:** agenda só com nomes salvos e telefone, inclusive por LID; importar selecionados e todos, com e sem órgão; repetir sem duplicar.
- **#198:** pela API (a tela vem na #200), reagir a uma mensagem recebida do cliente e a uma enviada pelo setor (pelo painel e pelo celular): a reação aparece no celular do cliente, sem apelido, na mensagem certa; trocar o emoji substitui no celular; repetir o mesmo emoji remove; a reação feita no celular do setor é substituída pela do painel; com o número desconectado, a API avisa e nada muda.
- **#201:** pela API (a tela vem depois), conferir em `GET /api/tickets/{id}/messages` a citação de respostas feitas no celular do cliente: citando uma mensagem do chamado, recebida e enviada pelo setor (fica ligada, com o trecho); citando uma mensagem de antes do XET ou de um chamado já encerrado (sem ligação, com o trecho do WhatsApp); citando áudio, imagem, vídeo e PDF (tipo e legenda ou nome do arquivo, sem a mídia); e uma resposta citada feita no celular do setor. Conferir também a citação vinda de chat por LID e de mensagem temporária ou de visualização única, que o WhatsApp pode embrulhar e chegar como `unsupported` no trecho.
- **#202:** pela API (a tela vem depois), enviar com `quotedMessageId` um texto, uma imagem com legenda, um PDF e um áudio gravado citando: uma mensagem de texto do cliente, uma mensagem enviada pelo setor, um áudio, uma imagem e um PDF. No celular do cliente, cada resposta aparece com a bolha da citação na mensagem certa (com o trecho: texto, legenda ou nome do arquivo), o texto e a legenda com o apelido, e o áudio como mensagem de voz sem apelido. Desconectar, enviar citando (vira "Falhou"), reconectar e reenviar: chega uma vez só, com a mesma citação. Conferir também num chat por LID (se a bolha aparece citando a mensagem do cliente).

## Roteiro manual: reação e citação com o WhatsApp real

Acompanha a spec [#196](https://github.com/gcaspp-labs/xet/issues/196) (tarefa [#204](https://github.com/gcaspp-labs/xet/issues/204)). Só o aparelho real prova o formato que o adaptador falso simula, por isso estes itens são **manuais**: não entram no CI e não bloqueiam o merge de nenhuma tarefa. A execução e o registro do resultado são da pessoa, depois que as tarefas da spec entrarem.

**Antes de começar**

- Use só um **número de teste** ligado ao setor de teste, e outro celular de teste fazendo o papel do cliente. Nunca um número, contato ou órgão reais: o repositório é público, e o que for registrado aqui também.
- Mensagens e arquivos de teste com texto fictício (por exemplo "Bom dia, teste 1", `contrato-exemplo.pdf`). Não registre capturas com dados reais.
- O chamado de teste precisa estar **aberto e assumido** por quem vai reagir e citar. Quem não é o responsável só enxerga reações e citações, sem poder criar.
- Registre em cada linha a **data**, a **versão** (commit ou tag do XET em teste) e o **resultado** (OK, Falhou, com uma frase do que apareceu). Linhas não executadas ficam como **Pendente**.

### Reação do cliente (celular de teste → painel)

| # | O que fazer | O que esperar | Data, versão e resultado |
| --- | --- | --- | --- |
| R1 | No celular do cliente, reagir com 👍 a uma mensagem enviada pelo setor | A reação aparece embaixo da mensagem certa no painel, sem recarregar a página e sem o aviso "tipo de mensagem não suportado" | Pendente |
| R2 | No celular do cliente, reagir com ❤️ a uma mensagem que o próprio cliente mandou | A reação aparece embaixo dessa mensagem no painel | Pendente |
| R3 | Trocar o emoji da reação do cliente (por exemplo de 👍 para 😂) | O emoji novo substitui o anterior; não ficam dois | Pendente |
| R4 | Remover a reação no celular do cliente | A reação some do painel | Pendente |
| R5 | Recarregar a página e abrir o chamado de novo | As reações que sobraram continuam embaixo das mensagens | Pendente |
| R6 | Encerrar o chamado e, depois, reagir no celular do cliente a uma mensagem dele | A reação não aparece, nenhum chamado novo é aberto e o chamado encerrado não muda. **Depois deste item, crie e assuma outro chamado de teste antes de seguir para S1**, porque os próximos pedem um chamado aberto e assumido | Pendente |

### Reação do setor (painel → celular do cliente)

| # | O que fazer | O que esperar | Data, versão e resultado |
| --- | --- | --- | --- |
| S1 | No painel, reagir a uma mensagem do cliente com um dos 6 emojis rápidos (👍 ❤️ 😂 😮 😢 🙏) | O celular do cliente mostra a reação na mensagem certa, **sem apelido**, como qualquer reação | Pendente |
| S2 | Reagir a uma mensagem enviada pelo setor | A reação aparece no celular do cliente, na mensagem certa | Pendente |
| S3 | Reagir com um emoji fora dos 6, escolhido pelo "+" | O celular do cliente mostra esse emoji | Pendente |
| S4 | Trocar a reação escolhendo outro emoji | No celular, o emoji novo substitui o anterior | Pendente |
| S5 | Tocar de novo no mesmo emoji | A reação some do painel e do celular do cliente | Pendente |
| S6 | No painel, conferir quem reagiu por último | O painel mostra quem do setor reagiu, já que o cliente não vê o apelido | Pendente |
| S7 | No celular do setor (o aparelho do número de teste), reagir a uma mensagem | O painel mostra a reação como feita "pelo celular" | Pendente |
| S8 | Com uma mensagem ainda enviando ou que falhou, procurar o botão de reagir | A reação não é oferecida nessa mensagem | Pendente |
| S9 | Desconectar o número, reagir no painel e reconectar | Aparece o aviso de erro, a reação é desfeita na tela e nada chega ao celular do cliente | Pendente |

### Citação recebida (celular de teste → painel)

| # | O que fazer | O que esperar | Data, versão e resultado |
| --- | --- | --- | --- |
| C1 | No celular do cliente, responder citando uma mensagem de texto do setor | O painel mostra a citação acima da resposta, com o trecho certo | Pendente |
| C2 | Responder citando uma mensagem de texto do próprio cliente | O painel mostra a citação, ligada à mensagem do chamado | Pendente |
| C3 | Responder citando um áudio | A citação mostra o tipo e o nome (por exemplo "🎤 Áudio"), sem a mídia | Pendente |
| C4 | Responder citando uma imagem (com e sem legenda) | A citação mostra o tipo e a legenda, sem a imagem | Pendente |
| C5 | Responder citando um arquivo (`contrato-exemplo.pdf`) | A citação mostra "📎 contrato-exemplo.pdf" | Pendente |
| C6 | Responder citando uma mensagem antiga, de antes do XET ou de outro chamado, que o XET não tem | O painel mostra a citação com o trecho que vem do WhatsApp | Pendente |
| C7 | Recarregar a página e abrir o chamado de novo | Todas as citações continuam acima das mensagens | Pendente |

### Citação enviada (painel → celular do cliente)

| # | O que fazer | O que esperar | Data, versão e resultado |
| --- | --- | --- | --- |
| Q1 | No painel, responder citando uma mensagem de texto do cliente | O celular mostra a resposta com a bolha da citação na mensagem certa, e o apelido no texto | Pendente |
| Q2 | Responder citando uma mensagem enviada pelo setor | O celular mostra a bolha da citação na mensagem certa | Pendente |
| Q3 | Responder citando um arquivo, enviando texto | A citação aparece no celular com o nome do arquivo | Pendente |
| Q4 | Responder citando um áudio | A citação aparece com o tipo "Áudio" | Pendente |
| Q5 | Enviar um arquivo com legenda citando uma mensagem | O arquivo chega com a citação, e a legenda leva o apelido | Pendente |
| Q6 | Gravar um áudio citando uma mensagem | O áudio chega como mensagem de voz, sem apelido, com a citação | Pendente |
| Q7 | Desconectar o número, enviar a resposta citada (vira "Falhou"), reconectar e usar "Reenviar" | Chega uma vez só ao celular, com a mesma citação | Pendente |
| Q8 | Começar uma citação e cancelá-la antes de enviar | A mensagem sai sem citação | Pendente |

### Seletor de emojis

| # | O que fazer | O que esperar | Data, versão e resultado |
| --- | --- | --- | --- |
| E1 | No campo de mensagem, colocar o cursor no meio do texto, inserir um emoji pelo seletor e enviar | O emoji entra na posição do cursor e chega igual ao celular do cliente, depois do apelido | Pendente |
| E2 | Receber no painel uma mensagem do cliente com emojis | Os emojis aparecem corretamente no painel | Pendente |
