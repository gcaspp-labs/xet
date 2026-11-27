# Verificação run-20261127-141827

- Commit: `7628aee8baba65a9b973a66a0d318e9508febb4f` (branch `ticket/495-formatacao-whatsapp`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-27 14:18:27 -0300
- Resumo gerado em: 2026-11-27 14:19:02 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| mesclado-no-atendimento | NÃO PROVADO: não percorrido nesta execução | 0 | |
| mesclar-encerrado-em-pendente | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pendente-retomada | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| formatacao-do-whatsapp (fora do mapa) | PASSOU | 6 | `evidence/formatacao-do-whatsapp/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

- atendimentos-message-revisions: [não coberto] Setor sem acesso (a API responde 403), temas claro e escuro e alto contraste, e a ordem completa de edições intercaladas entre o XET e o celular do setor (testes ponta a ponta em `frontend/e2e/atendimentos-message-changes.spec.ts` e `message-edit-delete.spec.ts`, e integração em `backend/internal/helpdesk/message_versions_test.go`).
- atendimentos-message-revisions: [manual] A mesma consulta depois de uma edição ou exclusão real recebida pelo Whatsmeow.
- close: [não coberto] Correção de chamado encerrado (`correction.spec.ts`).
- close: [não coberto] Cancelamento de chamado em atendimento e as permissões do cancelamento (`closing.spec.ts`).
- close: [não coberto] Trocar o órgão só para este chamado, no formulário (`closing.spec.ts`).
- connection: [não coberto] Aparelho que não pôde ser avisado ao desvincular (`connection.spec.ts`).
- connection: [não coberto] Volta da conexão ao reiniciar o serviço (`TestConnectionSurvivesRestart`, só integração).
- connection: [manual] Ler o QR code real com o celular do setor.
- connection: [manual] O QR code real trocando sozinho a cada 20 segundos.
- connection: [manual] O celular mostrando "Central de Atendimento" em vez de "Outro dispositivo".
- connection: [manual] Reiniciar o serviço e ver o número voltar sem novo QR code.
- connection: [manual] Desvincular pelo celular e pela tela, com o aparelho sumindo do celular.
- consult-closed-tickets: [não coberto] Paginação, ordem pelas demais colunas e correção do atendimento na ficha (`atendimentos.spec.ts`, `correction.spec.ts`).
- consult-closed-tickets: [não coberto] Abas Detalhes e Histórico da ficha e o chamado anterior de uma transferência (`ficha-atendimento.spec.ts`; o chamado anterior também está em `transfer`).
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
- conversas-menu: [não coberto] Listar só os chamados próprios, ordenar por atividade e trocar de chamado (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- edit-delete-messages-chamados: [não coberto] Resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- edit-delete-messages-chamados: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- edit-delete-sent-message: [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- edit-delete-sent-message: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- mesclar-encerrado-em-pendente: [não coberto] O atendimento cancelado também mescla, herdando o motivo do cancelamento no registro de A: fica nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts`.
- mesclar-encerrado-em-pendente: [não coberto] A corrida de alguém retomar o pendente escolhido antes da mesclagem, e as recusas (transferido, já mesclado, sem permissão de correção, sem pendente do contato): também nos testes de `frontend/e2e/mesclar-em-pendente.spec.ts` e nos testes do backend.
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
- pendente-retomada: [não coberto] Recusas (retomar sem permissão, pendente de outro contato ou setor, chamado devolvido à fila antes do retomar) e a atualização ao vivo para quem só assiste: ficam nos testes de `frontend/e2e/pendente.spec.ts`.
- pendente-retomada: [não coberto] Aviso de pendentes no sino de notificações, que está fora do escopo da spec #332.
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`conversas.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando à fila de Chamados sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Histórico dos chamados do contato, na ficha do atendimento (`ficha-atendimento.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- transfer: [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261127-141827/logs/backend.log`

## Detalhe de cada jornada

## Jornada formatacao-do-whatsapp: PASSOU

Commit `7628aee8baba65a9b973a66a0d318e9508febb4f`, início 2026-11-27T17:18:46.113Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado e um cliente com mensagens formatadas (712 ms)
2. ok: Atendente abre o chamado da fila e assume (697 ms)
3. ok: Balão recebido mostra negrito, itálico, riscado e código sem os símbolos (228 ms): `01-recebida-formatada.png`
4. ok: Casos que não formatam e link com "_" continuam como texto e link (246 ms): `02-texto-sem-formatacao-e-link.png`
5. ok: Resposta enviada sai formatada, e o texto guardado mantém os marcadores (397 ms): `03-resposta-formatada.png`
6. ok: Estado final no banco: os marcadores continuam guardados (122 ms)

#### Estado final observado

Texto guardado da resposta:

```json
"*Atendente1 926114594:*\nResposta *importante* e _calma_."
```

Chamado verificado:

```json
1
```

## Jornada reply: PASSOU

Commit `7628aee8baba65a9b973a66a0d318e9508febb4f`, início 2026-11-27T17:18:50.231Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (536 ms)
2. ok: Sem assumir, não há como responder (552 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (242 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (386 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (331 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (991 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (110 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (318 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (294 ms)
10. ok: Pela API, quem não é responsável também é recusado (290 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (519 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (469 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (364 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (145 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 6,
  "linhas": 1
}
```

Resposta indevida pela API:

```json
{
  "http": 403,
  "mensagensAlteradas": 0
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "origin": "customer",
    "type": "text",
    "status": null,
    "body": "Preciso do contracheque",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "read",
    "body": "*Atendente1 930232745:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 930232745:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 930232745:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 930232745:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
