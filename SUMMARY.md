# Verificação run-20261103-210734

- Commit: `78e14f19b378de4aece1d2ddba34ec00ea5abab1` (branch `task/46-tamanho-do-texto-e-alto-contraste`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-03 21:07:36 -0300
- Resumo gerado em: 2026-11-03 21:10:06 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| accessibility (fora do mapa) | PASSOU | 13 | `evidence/accessibility/` |
| accessibility-toast (fora do mapa) | FALHOU | 5 | `evidence/accessibility-toast/` |

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
- receive-and-assign: [não coberto] Assumir pela lista da tela da conversa, sem mudar de tela (`conversation.spec.ts`).
- receive-and-assign: [não coberto] Vários chamados com a mesma pessoa, sem limite (`panel.spec.ts`).
- receive-and-assign: [não coberto] Aviso de queda do tempo real e volta automática (`panel.spec.ts`).
- receive-and-assign: [não coberto] Grupos ignorados e mensagem enviada pelo celular do setor (só testes de integração).
- receive-and-assign: [manual] Mensagem real do WhatsApp chegando ao painel sem recarregar.
- receive-and-assign: [manual] Mensagem real em grupo não aparece; resposta pelo celular do setor aparece no chamado.
- reply: [não coberto] Notas internas, "Falou com" e histórico do contato (`conversation.spec.ts`).
- reply: [não coberto] Áudio gravado, imagens, vídeos e mídias recebidas (`media.spec.ts`).
- reply: [não coberto] Mensagens `pending` marcadas como `failed` ao reiniciar o serviço (só testes de integração).
- reply: [manual] Texto, imagem e PDF chegando ao celular do contato.
- reply: [manual] "Entregue" e "Lida" pelos recibos reais do WhatsApp.
- reply: [manual] Reenvio depois de falha sem duplicar no celular.
- reply: [manual] Áudio gravado chegando como mensagem de voz, com a duração certa.
- transfer: [não coberto] Devolver à fila (`return.spec.ts`).
- transfer: [não coberto] Abrir a conversa anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 72 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/evidence.

## Detalhe de cada jornada

## Jornada accessibility: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:07:56.125Z, duração 10 s.

#### Passos

1. ok: Preparar setor, módulos e dois chamados (551 ms)
2. ok: Tamanhos Padrão, Grande e Maior mudam o texto e persistem (1607 ms): `01-painel-maior.png`
3. ok: Alto contraste e tamanho aplicados antes do JavaScript do app (544 ms)
4. ok: Preferências chegam a outra aba com o menu fechado (1196 ms)
5. ok: Painel, menu e sino medidos em 7:1 — Claro (787 ms): `02-menu-Claro.png`, `03-sino-Claro.png`
6. ok: Painel, menu e sino medidos em 7:1 — Escuro (705 ms): `04-menu-Escuro.png`, `05-sino-Escuro.png`
7. ok: Abrir e assumir em Maior, título e ações acessíveis (333 ms): `06-conversa-maior.png`
8. ok: Conversa, campos, status e encerramento com erros — Claro (791 ms): `07-encerramento-Claro.png`
9. ok: Conversa, campos, status e encerramento com erros — Escuro (768 ms): `08-encerramento-Escuro.png`
10. ok: 375px, Maior: conversa, sino e encerramento sem rolagem horizontal (528 ms): `09-celular-conversa.png`, `10-celular-sino.png`, `11-celular-encerramento.png`
11. ok: Número desconectado com palavra e contraste nos dois temas (1058 ms): `12-desconectado-Claro.png`, `13-conexao-Claro.png`, `14-desconectado-Escuro.png`, `15-conexao-Escuro.png`
12. ok: Sistema escuro e claro forçado preservam alto contraste (428 ms)
13. ok: Estado final no banco: chamado e mensagem preservados (130 ms)

#### Estado final observado

Painel Claro:

```json
{
  "failures": [],
  "measured": 47
}
```

Menu Claro:

```json
{
  "failures": [],
  "measured": 61
}
```

Foco sino Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Sino Claro:

```json
{
  "failures": [],
  "measured": 58
}
```

Painel Escuro:

```json
{
  "failures": [],
  "measured": 47
}
```

Menu Escuro:

```json
{
  "failures": [],
  "measured": 61
}
```

Foco sino Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Sino Escuro:

```json
{
  "failures": [],
  "measured": 58
}
```

Conversa Claro:

```json
{
  "failures": [],
  "measured": 66
}
```

Foco mensagem Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Encerramento Claro:

```json
{
  "failures": [],
  "measured": 95
}
```

Foco assunto Claro:

```json
{
  "color": "rgb(0, 0, 0)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(255, 255, 255)",
  "ratio": 21
}
```

Conversa Escuro:

```json
{
  "failures": [],
  "measured": 66
}
```

Foco mensagem Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Encerramento Escuro:

```json
{
  "failures": [],
  "measured": 95
}
```

Foco assunto Escuro:

```json
{
  "color": "rgb(255, 255, 255)",
  "width": "3px",
  "style": "solid",
  "background": "rgb(10, 13, 14)",
  "ratio": 19.501925251824805
}
```

Sino desconectado Claro:

```json
{
  "failures": [],
  "measured": 74
}
```

Conexão Claro:

```json
{
  "failures": [],
  "measured": 23
}
```

Sino desconectado Escuro:

```json
{
  "failures": [],
  "measured": 31
}
```

Conexão Escuro:

```json
{
  "failures": [],
  "measured": 23
}
```

Chamados:

```json
[
  {
    "id": 1,
    "status": "in_progress",
    "assignee_id": 2
  },
  {
    "id": 2,
    "status": "queued",
    "assignee_id": null
  }
]
```

## Jornada accessibility-toast: FALHOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:09:33.530Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado (454 ms)
2. ok: Medir aviso de chamado recebido em Padrão (495 ms): `01-aviso-Padrão.png`
3. ok: Medir aviso de chamado recebido em Maior (485 ms): `02-aviso-Maior.png`
4. ok: Estado final no banco (124 ms)
5. FALHOU: Aviso cresce 30% em Maior, como o restante do texto (4 ms)

#### Falha

```text
Error: expect(received).toBeCloseTo(expected, precision)

Expected: 1.3
Received: 1

Expected precision:    2
Expected difference: < 0.005
Received difference:   0.30000000000000004
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toBeCloseTo (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:29:29
    at Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:27)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:28:10
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-210734/accessibility-toast.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       12048         936        1757        4528        3373
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2096456 956900  73604 4563288   24   80  7366   899 8298    7  7  3 87  3  0  0
 0  0 2096456 956384  73604 4563212    0    0     8     0 10008 8709  8  2 90  0  0  0
 0  0 2096456 942136  73604 4561476    0    0     0    16 11038 10714  8  3 89  0  0  0
```

#### Estado final observado

Padrão:

```json
{
  "toast": "13px",
  "body": "14px"
}
```

Maior:

```json
{
  "toast": "13px",
  "body": "18.2px"
}
```

Chamados:

```json
[
  {
    "status": "queued"
  },
  {
    "status": "queued"
  }
]
```

## Jornada close: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:23.453Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (532 ms)
2. ok: Atendente assume o chamado (274 ms)
3. ok: Formulário vazio não encerra e diz o que falta (417 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (979 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (503 ms)
6. ok: Fim antes do início é recusado (127 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (480 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (91 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (294 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (340 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1089 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (239 ms)

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
  "organization": "Prefeitura 903455037",
  "closed_by": "Atendente1 903454392",
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
    "actor": "Atendente1 903454392"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 903454392"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 903454392"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 4,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:30.568Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (393 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (426 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (284 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (395 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (349 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (398 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1241 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (713 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (823 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (229 ms)

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
    "actor": "Supervisor 910569220"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:36.937Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (622 ms)
2. ok: Atendente entra e vê a fila vazia (131 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (206 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (155 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (240 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (289 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (209 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (285 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (175 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1093 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (621 ms)

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
  "assignee": "Atendente1 916938268",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 916938268"
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

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:42.673Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (429 ms)
2. ok: Sem assumir, não há como responder (346 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (170 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (289 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (266 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (87 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (178 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (264 ms)
9. ok: Pela API, quem não é responsável também é recusado (279 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (389 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (277 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (321 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (118 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 10,
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
    "body": "Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada transfer: PASSOU

Commit `78e14f19b378de4aece1d2ddba34ec00ea5abab1`, início 2026-11-04T00:08:47.789Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1109 ms)
2. ok: Atendente assume o chamado (436 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (301 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1063 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (221 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (18 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (965 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (250 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (410 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1601 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (596 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (252 ms)

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
  "assignee": "Atendente1 927789184",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 927789184",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 18,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 927789184",
    "changes": {
      "assignee_id": {
        "to": 19,
        "from": 18
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 927789184",
    "changes": {
      "assignee_id": {
        "to": 18,
        "from": 19
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 927789184",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 927790770",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 10,
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
