# Verificação run-20261121-070613

- Commit: `65dc18762d47f4f0f519a42ca4bb22cf7b780de1` (branch `ticket/325-cartao-contato`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-21 07:06:15 -0300
- Resumo gerado em: 2026-11-21 07:10:02 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-sent-message | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| contact-cards (fora do mapa) | PASSOU | 7 | `evidence/contact-cards/` |

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
- Log: `.verify-app/runs/run-20261121-070613/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 35 arquivo(s) em .verify-app/runs/run-20261121-070613/evidence.

## Detalhe de cada jornada

## Jornada consult-closed-tickets: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:09:17.311Z, duração 9 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2609 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (349 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1879 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (487 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (283 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1375 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (261 ms)

#### Estado final observado

Chamados encerrados do setor (banco):

```json
"[{\"closure_type\":\"transferred\",\"has_closed_at\":true},{\"closure_type\":\"cancelled\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true},{\"closure_type\":\"resolved\",\"has_closed_at\":true}]"
```

Chamados abertos do setor, fora da lista (banco):

```json
"[{\"n\":1}]"
```

Filtro de situação na API:

```json
"HTTP 400"
```

Setor de outro, para atendente:

```json
"HTTP 403"
```

## Jornada contact-cards: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:08:57.631Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, atendente e os contatos cadastrados (762 ms)
2. ok: O cliente manda três contatos e a Fila mostra "👤 Nome" (232 ms): `01-fila-com-a-previa.png`
3. ok: Assumido, o chamado abre com os três cartões no mesmo balão (695 ms): `02-tres-cartoes-recebidos.png`
4. ok: Copiar o telefone de um cartão recebido, pelo teclado (162 ms): `03-telefone-copiado.png`
5. ok: Cartão enviado aparece com a situação de entrega (321 ms): `04-cartao-enviado-lida.png`
6. ok: Encerrado, o detalhe de Atendimentos mostra o cartão só para leitura (382 ms): `05-atendimentos-so-leitura.png`
7. ok: Estado final no banco (227 ms)

#### Estado final observado

Mensagens de contato do chamado:

```json
[
  {
    "type": "contact",
    "status": null,
    "first_card": "Ana Beatriz Nunes",
    "cards": 3
  },
  {
    "type": "contact",
    "status": "read",
    "first_card": "Roberto Almeida",
    "cards": 1
  }
]
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved"
}
```

## Jornada receive-and-assign: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:09:04.863Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (637 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (150 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (181 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (147 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (232 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (321 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (192 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (346 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (201 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (329 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1027 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (640 ms)

#### Estado final observado

Disputa simultânea: respostas HTTP e auditoria:

```json
{
  "respostas": [
    200,
    409
  ],
  "registrosDeAuditoria": 1
}
```

Outro setor pedindo o chamado pela API:

```json
{
  "http": 403
}
```

Chamado:

```json
{
  "protocol": "2026-000004",
  "status": "in_progress",
  "assignee": "Atendente1 744864834",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 744864834"
  }
]
```

Mensagens e chamados abertos do contato:

```json
{
  "mensagens": 2,
  "chamadosAbertos": 1
}
```

## Jornada reply: PASSOU

Commit `65dc18762d47f4f0f519a42ca4bb22cf7b780de1`, início 2026-11-21T10:09:11.101Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (458 ms)
2. ok: Sem assumir, não há como responder (416 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (217 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (301 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (269 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (749 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (87 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (266 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (259 ms)
10. ok: Pela API, quem não é responsável também é recusado (262 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (416 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (292 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (287 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (118 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 11,
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
    "body": "*Atendente1 751101638:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 751101638:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 751101638:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 751101638:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Comparação com o design (#325)

Protótipo aprovado em `prototype/325` (`prototype-captures/325-*.png`).

- **Cartões recebidos** (`contact-cards/02-tres-cartoes-recebidos.png` × `325-cartoes-claro.png`): mesmo ícone de contato no círculo, nome em corpo forte, órgão e município em citação e telefones em mono, um cartão por contato dentro do mesmo balão. Sem diferença de composição.
- **Cartão enviado** (`contact-cards/04-cartao-enviado-lida.png` × `325-cartoes-claro.png`): cartão sobre o fundo de destaque do balão, sem botão de copiar, com a situação "Lida" no pé. Sem diferença.
- **Prévia** (`contact-cards/01-fila-com-a-previa.png` × `325-cartoes-claro.png`): "👤 Ana Beatriz Nunes" na Fila e em Meus chamados. Sem diferença.
- **Cópia pelo teclado** (`contact-cards/03-telefone-copiado.png` × `325-copiado-claro.png`): foco visível no botão e o aviso "Telefone copiado". A cópia devolveu `019997774321` (0 + DDD + número, sem o +55), como a ficha.
- **Atendimentos só leitura** (`contact-cards/05-atendimentos-so-leitura.png` × `325-atendimentos-claro.png`): cartões com o botão de copiar, sem campo de mensagem nem "Reenviar", e a faixa "Só leitura". Sem diferença. O protótipo mantém o botão de copiar no cartão recebido em Atendimentos; a implementação também, porque copiar não altera nada.
- **Tema escuro e alto contraste:** não percorridos nesta execução; ficam cobertos pelos testes de contraste em `frontend/e2e/accessibility.spec.ts` e pela captura do protótipo.

## Não provado

- **WhatsApp real:** receber um cartão de um e de vários contatos e tocar no cartão enviado no celular continuam como verificação manual, com número de teste (`docs/pilot-validation.md`); o adaptador falso não prova o vCard real.
- **Colega do setor sem as ações de envio e a falha com "Reenviar" sem duplicar:** ficam nos testes ponta a ponta `frontend/e2e/contact-card.spec.ts` desta PR, não na jornada.
- **Tema escuro e alto contraste do cartão:** não percorridos; cobertos pelo protótipo aprovado e pelos testes de acessibilidade.
