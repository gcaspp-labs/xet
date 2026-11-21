# Verificação run-20261121-115431

- Commit: `2c57e5fba1c84f7fffcf617e3b9a766c1960ee54` (branch `ticket/326-enviar-contato`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-21 11:54:33 -0300
- Resumo gerado em: 2026-11-21 11:59:24 -0300
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
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| send-contact (fora do mapa) | PASSOU | 7 | `evidence/send-contact/` |

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
- edit-delete-messages-chamados: [não coberto] Recusa e resultado incerto do WhatsApp na tela, prazo de 15 minutos e de exclusão para todos, mensagem enviando ou com falha, áudio, temas, teclado e foco, confirmação duplicada, prévia na lista (inclusive excluir para todos), citação em preparo que some quando a mensagem citada é excluída, supervisor já conectado, mensagem do celular sem menu e perda de responsável durante a edição (testes ponta a ponta em `frontend/e2e/message-edit-delete.spec.ts`).
- edit-delete-messages-chamados: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- edit-delete-sent-message: [não coberto] Prazo de 15 minutos, prazo da exclusão para todos, mensagem enviando ou com falha, áudio, eco, reinício, resultado incerto, concorrência com encerramento e transferência, prévia da lista escondida (testes de integração em `backend/internal/helpdesk/message_actions_test.go`).
- edit-delete-sent-message: [manual] Edição de texto e legenda e exclusão para todos chegando num celular real pelo Whatsmeow.
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
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
- Log: `.verify-app/runs/run-20261121-115431/logs/backend.log`

## Detalhe de cada jornada

## Jornada reply: PASSOU

Commit `2c57e5fba1c84f7fffcf617e3b9a766c1960ee54`, início 2026-11-21T14:56:49.885Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (699 ms)
2. ok: Sem assumir, não há como responder (474 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (239 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (417 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (299 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (1063 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (102 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (245 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (246 ms)
10. ok: Pela API, quem não é responsável também é recusado (300 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (551 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (474 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (388 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (143 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 2,
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
    "body": "*Atendente1 009886963:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 009886963:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada send-contact: PASSOU

Commit `2c57e5fba1c84f7fffcf617e3b9a766c1960ee54`, início 2026-11-21T14:56:58.148Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, atendente e um contato cadastrado no órgão (865 ms)
2. ok: O clipe abre o menu com Arquivo e Contato (281 ms): `01-menu-do-anexo.png`
3. ok: Contato abre a busca em Meu setor, com os filtros (270 ms): `02-busca.png`
4. ok: A busca mostra nome, telefone e órgão com o município (162 ms): `03-resultado.png`
5. ok: Escolher o contato mostra a prévia do cartão (229 ms): `04-previa.png`
6. ok: Enviar fecha a janela e o cartão entra na conversa com a situação de entrega (366 ms): `05-enviado.png`
7. ok: Estado final no banco (120 ms)

#### Estado final observado

Mensagens do chamado:

```json
[
  {
    "type": "text",
    "status": null,
    "accepted_by_provider": true,
    "contact_cards": null
  },
  {
    "type": "contact",
    "status": "sent",
    "accepted_by_provider": true,
    "contact_cards": "[{\"name\": \"Joana Alves 2\", \"phones\": [{\"phone\": \"5511000000002\", \"wa_id\": null}], \"organization\": \"Prefeitura 018150736 — Campinas\"}]"
  }
]
```

## Comparação com o design (#326, versão A)

- **Menu do anexo:** igual ao protótipo — clipe, menu acima com `Arquivo` e `Contato`, ícones de 15px.
- **Busca:** janela de 460px, busca com foco, filtros de setor/município/órgão, a linha com nome, telefone e órgão com o município, e "Cancelar" no rodapé. Igual.
- **Prévia:** o cartão do #325 no formato do enviado, com "Como o cliente recebe" e o rodapé `Voltar`, `Cancelar` e `Enviar`. A frase é a da issue ("Sem legenda, como o áudio. O cliente toca para conversar ou salvar."), mais curta que a do protótipo.
- **Botões do rodapé:** o protótipo pinta `Cancelar` como `outline`; a janela usa a `FormDialog` do design system, em que `Cancelar` é `ghost` e `Voltar` também. É a única diferença visual em relação ao protótipo.
- **Depois de enviar:** o cartão no balão do XET com "Enviada", a prévia "👤 Nome" em Meus chamados e o foco no campo de mensagem. Igual.

## Não provado

- WhatsApp real: enviar o cartão e tocar nele no celular, e receber cartão de um e de vários contatos continuam como verificação manual em `docs/pilot-validation.md`.
- Contato sem telefone: não há como cadastrar um pela API (o formulário exige telefone); a busca filtra `registered && phone` e o backend recusa o envio de contato sem telefone (teste de integração `contact_send_test.go`).
- Envio do cartão como resposta citada: fora do escopo desta fatia (spec #312).

## Erros no log

- `logs/backend.log`: um `WARN "send message" ... "sector not connected"` na jornada `reply`, no passo que derruba o número de propósito ("Número caído: a mensagem falha"). Esperado.
- Nenhum 5xx, nenhum erro de JavaScript na tela.
