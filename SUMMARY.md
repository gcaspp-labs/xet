# Verificação run-20261117-201435

Commit: e33fd59141d478512f00c8dade6e14926605a9d7. Worktree: clean. Level: journeys.

- Commit: `e33fd59141d478512f00c8dade6e14926605a9d7` (branch `ticket/244-transferir-setor-sem-formulario`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-17 20:14:37 -0300
- Resumo gerado em: 2026-11-17 20:24:37 -0300
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
| sector-transfer-without-form (fora do mapa) | PASSOU | 7 | `evidence/sector-transfer-without-form/` |

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
- Log: `.verify-app/runs/run-20261117-201435/logs/backend.log`

## Detalhe de cada jornada

## Jornada consult-closed-tickets: PASSOU

Commit `e33fd59141d478512f00c8dade6e14926605a9d7`, início 2026-11-17T23:22:27.423Z, duração 6 s.

#### Passos

1. ok: Preparar dois setores, órgãos, contatos e chamados encerrados (1398 ms)
2. ok: Atendente abre Atendimentos: só encerrados, mais recentes primeiro, situação de cada um (232 ms): `01-lista-atendente.png`
3. ok: Busca e filtros: texto sem acento, responsável, módulo, assunto e período (1332 ms): `02-assunto-com-sugestao.png`, `03-periodo-sem-resultado.png`
4. ok: Ordem e endereço: clicar em Contato ordena e guarda; recarregar mantém (316 ms): `04-ordem-e-busca-no-endereco.png`
5. ok: Clicar na linha abre a ficha só leitura em /atendimentos/:id (183 ms): `05-ficha.png`
6. ok: Administrador: coluna Setor, Responsável e Módulo travados até escolher o setor (1014 ms): `06-admin-travado.png`, `07-admin-filtrado.png`
7. ok: Estado final no banco e na API (124 ms)

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

## Jornada sector-transfer-without-form: PASSOU

Commit `e33fd59141d478512f00c8dade6e14926605a9d7`, início 2026-11-17T23:20:19.473Z, duração 120 s.

#### Passos

1. ok: Preparar dois setores conectados e um contato não cadastrado na fila (474 ms)
2. ok: Atendente assume o chamado pela tela (127 ms)
3. ok: Responsável transfere sem formulário, com motivo, pela rota nova (sem tela até a #247) (67 ms)
4. ok: Origem aparece em Atendimentos como Transferido, sem assunto (3177 ms): `01-origem-no-historico.png`
5. ok: Ficha da origem abre só leitura, transferida para o destino (168 ms): `02-ficha-origem.png`
6. ok: Destino recebe o chamado na fila e abre a conversa (175 ms): `03-destino-na-fila.png`
7. ok: Estado final no banco e na auditoria (218 ms)

#### Estado final observado

Origem:

```json
{
  "status": "closed",
  "closure_type": "transferred",
  "subject": null,
  "resolution": null,
  "organization_id": null,
  "transfer_reason": "Férias são com o outro setor.",
  "ended_at_transfer": true,
  "modules": 0
}
```

Destino:

```json
{
  "status": "queued",
  "previous_ticket_id": 1,
  "organization_id": null,
  "protocol": "2026-000002"
}
```

Auditoria da origem:

```json
{
  "action": "ticket_transferred_sector",
  "reason": "Férias são com o outro setor.",
  "closure": "transferred"
}
```

## Jornada transfer: PASSOU

Commit `e33fd59141d478512f00c8dade6e14926605a9d7`, início 2026-11-17T23:22:19.324Z, duração 8 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (598 ms)
2. ok: Atendente assume o chamado (147 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (195 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (815 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (219 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (8 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (776 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (117 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (193 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1522 ms): `06-formulario-outro-setor.png`, `07-origem-no-historico.png`
11. ok: Destino recebe na fila, assume e responde (420 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (102 ms)
13. ok: Chamado de origem abre a ficha só leitura, com o destino na cadeia (298 ms): `10-ficha-origem.png`
14. ok: Destino cancela o chamado novo e a ficha dele traz a origem (666 ms): `11-ficha-destino-com-origem.png`, `12-ficha-origem-pelo-destino.png`
15. ok: Estado final do destino cancelado no banco (52 ms)

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
  "assignee": "Atendente1 739324118",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 739324118",
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
    "actor": "Atendente1 739324118",
    "changes": {
      "assignee_id": {
        "to": 8,
        "from": 7
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 739324118",
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
    "sector": "Setor 739324118",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 739325294",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 4,
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
  "previous_ticket_id": 4
}
```
