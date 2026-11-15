# Verificação run-20261115-094126

- Commit: `120bb65e5ab8c66ff5ec245d51e1e8240582c87f` (branch `ticket/179-jornadas-verificacao-atendimento`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-15 09:41:28 -0300
- Resumo gerado em: 2026-11-15 09:46:57 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| final-routes | PASSOU | 6 | `evidence/final-routes/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 15 | `evidence/transfer/` |

## Fica para a verificação manual ou sem cobertura nestas jornadas

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
- final-routes: [não coberto] `/atendimentos/<id>` de chamado ativo, sem acesso (403), e o item do menu ativo em cada caso (`rotas.spec.ts`).
- final-routes: [não coberto] Endereços desconhecidos sem sessão, que vão para o login (`rotas.spec.ts`).
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
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 5, sendo 5 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261115-094126/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 77 arquivo(s) em .verify-app/runs/run-20261115-094126/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:18.966Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (552 ms)
2. ok: Atendente assume o chamado (289 ms)
3. ok: Formulário vazio não encerra e diz o que falta (315 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (869 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (510 ms)
6. ok: Fim antes do início é recusado (118 ms)
7. ok: Com tudo certo, encerra e volta a Chamados, com o atendimento no histórico (649 ms): `03-formulario-completo.png`, `04-historico-encerrados.png`
8. ok: Supervisor vê o atendimento no histórico, sem recarregar (101 ms): `05-supervisor-historico.png`
9. ok: Chamado encerrado abre a ficha só leitura e não aceita resposta (309 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (326 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1331 ms): `08-cancelamento.png`, `09-cancelado-no-historico.png`
12. ok: Estado final do encerramento no banco (232 ms)

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
  "organization": "Prefeitura 598968756",
  "closed_by": "Atendente1 598967464",
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
    "actor": "Atendente1 598967464"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 598967464"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 598967464"
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

## Jornada connection: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:26.427Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (385 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (473 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (273 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (381 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (427 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (397 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1046 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (683 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve à tela Chamados (771 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (232 ms)

#### Estado final observado

Atendente tentando conectar pela API:

```json
{
  "http": 403
}
```

Setor:

```json
{
  "connection_status": "logged_out",
  "phone": null,
  "external_account_id": null
}
```

Auditoria da conexão:

```json
[
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": null
  },
  {
    "action": "sector_connected",
    "actor": null
  },
  {
    "action": "sector_disconnected",
    "actor": "Supervisor 606427797"
  }
]
```

## Jornada consult-closed-tickets: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:32.659Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (2569 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (360 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1811 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (408 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (267 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1334 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (256 ms)

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

## Jornada consult-subjects: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:41.317Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (476 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (398 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (329 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (191 ms): `03-solucao-copiada.png`
5. ok: Outro chamado volta à Fila e o anterior lembra a busca (676 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (209 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "*Atendente1 621318798:*\nVou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada conversas-menu: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:44.717Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (402 ms)
2. ok: Abrir Chamados pelo menu (146 ms): `01-conversas-vazia.png`
3. ok: Abrir um chamado e conferir os temas (1641 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (119 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada final-routes: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:48.110Z, duração 4 s.

#### Passos

1. ok: Preparar setor, um chamado encerrado e um ainda na fila (812 ms)
2. ok: Os três endereços antigos mostram Não encontrado, com Voltar (728 ms): `01-conversas.png`
3. ok: Um endereço desconhecido qualquer mostra Não encontrado, com Voltar (307 ms): `02-endereco-desconhecido.png`
4. ok: Chamado inexistente em /chamados/:id mostra Não encontrado, com Voltar (628 ms): `03-chamado-inexistente.png`
5. ok: /chamados/:id de um chamado encerrado leva à ficha em /atendimentos/:id (301 ms): `04-encerrado-leva-a-ficha.png`
6. ok: Estado final: navegar pelos endereços não mudou nenhum chamado (120 ms)

#### Estado final observado

Chamados do setor (banco):

```json
[
  {
    "status": "closed",
    "closure_type": "resolved"
  },
  {
    "status": "queued",
    "closure_type": null
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:52.078Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (574 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (117 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (187 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (136 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (227 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (282 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (146 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (306 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (196 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (274 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (975 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (582 ms)

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
  "protocol": "2026-000015",
  "status": "in_progress",
  "assignee": "Atendente1 632079698",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 632079698"
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

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:43:57.702Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (422 ms)
2. ok: Sem assumir, não há como responder (384 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (190 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (226 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (263 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (83 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (196 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (282 ms)
9. ok: Pela API, quem não é responsável também é recusado (244 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (358 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (277 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (267 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (118 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 21,
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
    "body": "*Atendente1 637703687:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 637703687:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 637703687:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `120bb65e5ab8c66ff5ec245d51e1e8240582c87f`, início 2026-11-15T12:44:02.627Z, duração 11 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1001 ms)
2. ok: Atendente assume o chamado (206 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (277 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (917 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (245 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (19 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (965 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (241 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (293 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (2033 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (773 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (240 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (327 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (854 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (111 ms)

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
  "assignee": "Atendente1 642628079",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 642628079",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 27,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 642628079",
    "changes": {
      "assignee_id": {
        "to": 28,
        "from": 27
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 642628079",
    "changes": {
      "assignee_id": {
        "to": 27,
        "from": 28
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 642628079",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 642629976",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 20,
    "subject": null
  }
]
```

Auditoria da origem:

```json
[
  {
    "action": "ticket_assigned"
  },
  {
    "action": "ticket_organization_linked"
  },
  {
    "action": "ticket_transferred_sector"
  }
]
```

Destino depois do cancelamento:

```json
{
  "status": "closed",
  "closure_type": "cancelled",
  "previous_ticket_id": 20
}
```
