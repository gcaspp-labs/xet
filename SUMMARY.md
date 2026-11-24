# Verificação run-20261124-140125

Commit: bcf3854efb1597d168d638dc047d182407a75c9e.

- Commit: `bcf3854efb1597d168d638dc047d182407a75c9e` (branch `ticket/404-nome-painel-chamados`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-24 14:01:27 -0300
- Resumo gerado em: 2026-11-24 14:03:10 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| atendimentos-message-revisions | NÃO PROVADO: não percorrido nesta execução | 0 | |
| close | PASSOU | 12 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| edit-delete-messages-chamados | PASSOU | 10 | `evidence/edit-delete-messages-chamados/` |
| edit-delete-sent-message | PASSOU | 9 | `evidence/edit-delete-sent-message/` |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | PASSOU | 7 | `evidence/message-revisions/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | PASSOU | 15 | `evidence/transfer/` |

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
- Log: `.verify-app/runs/run-20261124-140125/logs/backend.log`

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:36.821Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (360 ms)
2. ok: Atendente assume o chamado (175 ms)
3. ok: Formulário vazio não encerra e diz o que falta (244 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (597 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (393 ms)
6. ok: Fim antes do início é recusado (94 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (454 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (70 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (259 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (219 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (988 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (124 ms)

#### Estado final observado

Chamado cancelado:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "action": "ticket_cancelled",
  "reason": "Golpe do falso boleto.",
  "contact_registered": false
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque",
  "resolution": "Enviada a segunda via.",
  "organization": "Prefeitura 756823316",
  "closed_by": "Atendente1 756822595",
  "has_closed_at": true,
  "end_after_start": true,
  "modules": "Folha, Patrimônio"
}
```

Auditoria do encerramento:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 756822595"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 756822595"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 756822595"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 2,
  "status": "queued"
}
```

## Jornada consult-subjects: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:42.277Z, duração 2 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (302 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (247 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (220 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (119 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (540 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (122 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 762278782:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada edit-delete-messages-chamados: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:56.977Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (317 ms)
2. ok: Mensagem do cliente chega à fila (8 ms)
3. ok: Atendente assume e responde duas vezes (359 ms): `01-mensagens-enviadas.png`
4. ok: O menu da mensagem oferece Responder, Editar e Excluir (261 ms): `02-menu-da-mensagem.png`
5. ok: Editar: a faixa "Editando", o rascunho preservado e Cancelar (492 ms): `03-edicao-no-compositor.png`
6. ok: Editar e salvar: etiqueta Editada nas duas sessões (463 ms): `04-mensagem-editada.png`
7. ok: Excluir: a janela oferece as duas opções e Cancelar não exclui (441 ms): `05-janela-de-exclusao.png`
8. ok: Excluir para mim: aviso no lugar do conteúdo, nas duas sessões (665 ms): `06-mensagem-ocultada.png`
9. ok: Cliente edita e exclui no WhatsApp: conteúdo conhecido com etiqueta (214 ms): `07-alteracao-externa.png`
10. ok: Estado final no banco (119 ms)

#### Estado final observado

Mensagens do chamado:

```json
[
  {
    "body": "Preciso do boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "customer",
    "origin": "customer"
  },
  {
    "body": "*Atendente1 776978860:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": null,
    "deletion_origin": null,
    "origin": "agent"
  },
  {
    "body": "*Atendente1 776978860:*\nMensagem enviada por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "origin": "agent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "kind": "edit",
    "status": "accepted"
  },
  {
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

## Jornada edit-delete-sent-message: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:03:01.836Z, duração 2 s.

#### Passos

1. ok: Preparar setor conectado com dois atendentes (411 ms)
2. ok: Mensagem do cliente chega à fila (18 ms)
3. ok: Atendente assume e responde (337 ms): `01-mensagem-enviada.png`
4. ok: Quem não é o responsável não edita nem exclui (9 ms)
5. ok: Recusa do WhatsApp não muda a mensagem (184 ms)
6. ok: Responsável edita: a conversa mostra a nova versão sem recarregar (102 ms): `02-mensagem-editada.png`
7. ok: Excluir para todos: o conteúdo continua guardado (11 ms)
8. ok: Segunda mensagem é excluída só no XET (315 ms): `03-apos-exclusoes.png`
9. ok: Estado final no banco (242 ms)

#### Estado final observado

Mensagens enviadas:

```json
[
  {
    "id": 19,
    "body": "*Atendente1 781836107:*\nSegue o boleto de outubro",
    "edited": true,
    "deletion_scope": "everyone",
    "deletion_origin": "agent",
    "status": "sent"
  },
  {
    "id": 20,
    "body": "*Atendente1 781836107:*\nMensagem por engano",
    "edited": false,
    "deletion_scope": "local",
    "deletion_origin": "agent",
    "status": "sent"
  }
]
```

Ações (message_actions):

```json
[
  {
    "message_id": 19,
    "kind": "edit",
    "status": "refused"
  },
  {
    "message_id": 19,
    "kind": "edit",
    "status": "accepted"
  },
  {
    "message_id": 19,
    "kind": "delete_everyone",
    "status": "accepted"
  },
  {
    "message_id": 20,
    "kind": "delete_local",
    "status": "accepted"
  }
]
```

Versões e exclusão da primeira (message_changes):

```json
[
  {
    "kind": "original",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "edit",
    "origin": "agent",
    "deletion_scope": null
  },
  {
    "kind": "deletion",
    "origin": "agent",
    "deletion_scope": "everyone"
  }
]
```

Auditoria:

```json
[
  {
    "entity_id": 19,
    "action": "message_edited"
  },
  {
    "entity_id": 19,
    "action": "message_deleted"
  },
  {
    "entity_id": 20,
    "action": "message_deleted"
  }
]
```

## Jornada message-revisions: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:03:04.513Z, duração 2 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (249 ms)
2. ok: Mensagem do cliente chega à fila (11 ms)
3. ok: Atendente assume e vê a mensagem original (227 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (126 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (198 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (229 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (174 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 21,
  "body": "Preciso do balancete de outubro",
  "edited": true,
  "deletion_scope": "everyone",
  "deletion_origin": "customer"
}
```

Versões e exclusão (message_changes):

```json
[
  {
    "kind": "edit",
    "origin": "customer",
    "body": "versão antiga atrasada"
  },
  {
    "kind": "original",
    "origin": "customer",
    "body": "Preciso do balancete de setembro"
  },
  {
    "kind": "edit",
    "origin": "customer",
    "body": "Preciso do balancete de outubro"
  },
  {
    "kind": "deletion",
    "origin": "customer",
    "body": null
  }
]
```

Chamados do setor:

```json
[
  {
    "status": "in_progress"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:44.702Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (448 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (74 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (111 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (66 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (155 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (264 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (151 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (139 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (118 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (217 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (735 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (315 ms)

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
  "protocol": "2026-000006",
  "status": "in_progress",
  "assignee": "Atendente1 764703559",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 764703559"
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

## Jornada transfer: PASSOU

Commit `bcf3854efb1597d168d638dc047d182407a75c9e`, início 2026-11-24T17:02:48.895Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas e dois chamados na fila (609 ms)
2. ok: Atendente assume o chamado (154 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (221 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (767 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (224 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (7 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (852 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (122 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (206 ms)
10. ok: Transferência para outro setor é sem formulário e encerra a origem (1066 ms): `06-janela-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (496 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (118 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (248 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (742 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (58 ms)

#### Estado final observado

Resposta do responsável anterior pela API:

```json
{
  "http": 403
}
```

Chamado transferido:

```json
{
  "status": "in_progress",
  "assignee": "Atendente1 768896318",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 768896318",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 12,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 768896318",
    "changes": {
      "assignee_id": {
        "to": 13,
        "from": 12
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 768896318",
    "changes": {
      "assignee_id": {
        "to": 12,
        "from": 13
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 768896318",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": null,
    "transfer_reason": "Folha de março é com o outro setor.",
    "organization_id": null
  },
  {
    "sector": "Setor 768897595",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 10,
    "subject": null,
    "transfer_reason": null,
    "organization_id": null
  }
]
```

Auditoria da origem:

```json
[
  {
    "action": "ticket_assigned",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 12,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_sector",
    "changes": {
      "status": {
        "to": "closed",
        "from": "in_progress"
      },
      "ended_at": {
        "to": "2026-11-24T17:02:54.300054Z",
        "from": null
      },
      "sector_id": {
        "to": 6,
        "from": 5
      },
      "closure_type": {
        "to": "transferred",
        "from": null
      },
      "next_ticket_id": {
        "to": 11,
        "from": null
      },
      "transfer_reason": {
        "to": "Folha de março é com o outro setor.",
        "from": null
      }
    }
  }
]
```

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 10
}
```
