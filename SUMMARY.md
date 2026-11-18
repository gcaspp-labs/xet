# Verificação run-20261117-224935

Commit: e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1. Worktree: clean. Level: journeys.

- Commit: `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1` (branch `ticket/245-motivo-transferencia-quadro-origem`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-17 22:49:37 -0300
- Resumo gerado em: 2026-11-17 22:51:52 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | PASSOU | 7 | `evidence/consult-closed-tickets/` |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | PASSOU | 15 | `evidence/transfer/` |
| transfer-reason (fora do mapa) | PASSOU | 6 | `evidence/transfer-reason/` |

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

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261117-224935/logs/backend.log`

## Detalhe de cada jornada

## Jornada consult-closed-tickets: PASSOU

Commit `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1`, início 2026-11-18T01:51:41.774Z, duração 6 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (1435 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (233 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1326 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (290 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (186 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1126 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (121 ms)

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

## Jornada transfer: PASSOU

Commit `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1`, início 2026-11-18T01:51:33.686Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (598 ms)
2. ok: Atendente assume o chamado (176 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (208 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (671 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (200 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (10 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (799 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (116 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (169 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1464 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (459 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (120 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (250 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (667 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (56 ms)

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
  "assignee": "Atendente1 693687302",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 693687302",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 7,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 693687302",
    "changes": {
      "assignee_id": {
        "to": 8,
        "from": 7
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 693687302",
    "changes": {
      "assignee_id": {
        "to": 7,
        "from": 8
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 693687302",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 693688072",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 6,
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
  "previous_ticket_id": 6
}
```

## Jornada transfer-reason: PASSOU

Commit `e11d9b4e7e8a01fe2d3c57b8c4c70bbe80b0e0c1`, início 2026-11-18T01:51:27.874Z, duração 3 s.

#### Passos

1. ok: Preparar dois setores conectados e dois contatos fictícios na origem (520 ms)
2. ok: Responsável transfere os dois chamados pela rota nova, um com motivo e outro sem (88 ms)
3. ok: Origem: aviso da conversa mostra quem transferiu, o setor e o motivo (381 ms): `01-origem-com-motivo.png`, `02-origem-sem-motivo.png`
4. ok: Destino: aviso na conversa do chamado da fila mostra a origem e o motivo (381 ms): `03-destino-com-motivo.png`, `04-destino-sem-motivo.png`
5. ok: Destino encerra os dois; o quadro de origem mostra setor, protocolo, quem transferiu e o motivo, sem assunto nem resolução (493 ms): `05-quadro-com-motivo.png`, `06-quadro-sem-motivo.png`
6. ok: Estado final no banco (107 ms)

#### Estado final observado

Motivos guardados nas origens:

```json
[
  {
    "id": 1,
    "status": "closed",
    "closure_type": "transferred",
    "subject": null,
    "resolution": null,
    "transfer_reason": "Quem cuida de férias é o RH."
  },
  {
    "id": 2,
    "status": "closed",
    "closure_type": "transferred",
    "subject": null,
    "resolution": null,
    "transfer_reason": null
  }
]
```
