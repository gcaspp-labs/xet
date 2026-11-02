# Validação do piloto

Acompanha a T34. Cruza cada critério de validação da `spec.md` com os testes automatizados e com o que ainda precisa do servidor e do número real da Contabilidade.

A T34 só termina quando a última coluna da matriz estiver toda como **Atendido**. Até lá, ela fica `[~]` em `tasks.md`.

## Situação

- **Testes automatizados:** todos os critérios têm cobertura, com o WhatsApp simulado pelo adaptador falso.
- **Imagens e Compose:** testados em 2026-11-02 na máquina de desenvolvimento, com HTTPS local do Caddy. Ver "Teste da implantação".
- **Servidor:** local de implantação ainda não escolhido.
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
| 18 | Assumir abre a conversa; encerrar volta ao painel com o atendimento nos realizados | `TestClosedTodayListsWhatTheSectorClosed` | `panel.spec`, `closing.spec` | Não depende | Automatizado |
| 19 | Cancelar spam sem cadastrar o contato, com motivo e auditoria | `TestCancelFromTheQueueWithoutAssigning`, `TestCancelRequiresReason` | `closing.spec` | Não depende | Automatizado |
| 20 | Devolver chamado em atendimento à fila | `TestReturnToQueueAndSomeoneElseAssigns` | `return.spec` | Não depende | Automatizado |
| 21 | Arquivo acima do limite vira aviso, sem perder a mensagem | `TestUnavailableMediaBecomesNotice` | `media.spec` | Enviar arquivo acima de 100 MB | Pendente |
| 22 | Telefone do setor pelo QR code e recusa de número de outro setor | `TestPhoneFollowsTheConnection` | `connection.spec` | Telefone preenchido; celular mostra "Central de Atendimento"; recusa precisa de um segundo setor | Pendente |
| 23 | Desvincular pela tela e conectar de novo por QR code | `TestDisconnectFromTheScreen` | `connection.spec` | Aparelho some do celular; novo QR funciona | Pendente |
| 24 | Importar contatos do número sem duplicar | `TestImportContacts`, `TestImportKeepsExistingContact` | `directory.spec` | `SavedContacts` do Whatsmeow nunca foi executado com número real | Pendente |

## Teste da implantação

Executado com `deploy/compose.yml`, num projeto isolado, com `SITE_ADDRESS=localhost` e `COOKIE_SECURE=true`.

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

Fora deste teste: certificado público real, sinal de internet instável e carga.

## Roteiro de implantação

1. Escolher o servidor e o endereço. Para HTTPS automático, o domínio precisa apontar para o servidor e as portas 80 e 443 precisam estar acessíveis. Em rede interna, sem porta aberta, é preciso definir outra forma de emitir o certificado antes de subir. A gravação de áudio no navegador exige HTTPS.
2. Instalar Docker com o plugin Compose e clonar o repositório.
3. Copiar `deploy/.env.example` para `deploy/.env` e ajustar: `POSTGRES_PASSWORD` só com letras e números, `SITE_ADDRESS` com o domínio e `COOKIE_SECURE=true`.
4. Subir com `make up` e acompanhar com `make logs`.
5. Criar o administrador com `make create-admin NAME="Nome" EMAIL=email`.
6. Cadastrar a Contabilidade, o supervisor e os atendentes pela interface.
7. Conectar o número em Conexão, lendo o QR code.
8. Percorrer os critérios **Pendente** da matriz e atualizar a última coluna.

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
