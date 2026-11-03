# Verificação run-20261103-200427

- Commit: `6d09eea59c8481dc0d02acff74a03af62b0373ba` (branch `task/45-alertas-do-navegador-e-som`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-03 20:04:29 -0300
- Resumo gerado em: 2026-11-03 20:06:11 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| alerts (fora do mapa) | PASSOU | 12 | `evidence/alerts/` |
| alerts-settings (fora do mapa) | PASSOU | 6 | `evidence/alerts-settings/` |
| alerts-tabs (fora do mapa) | PASSOU | 4 | `evidence/alerts-tabs/` |
| alerts-tabs-return (fora do mapa) | FALHOU | 2 | `evidence/alerts-tabs-return/` |
| alerts-visibility (fora do mapa) | PASSOU | 3 | `evidence/alerts-visibility/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 43 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/evidence.

## Detalhe de cada jornada

## Jornada alerts: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:04:59.428Z, duração 13 s.

#### Passos

1. ok: Preparar setor conectado e atendente (424 ms)
2. ok: Entrar sem pedir permissão, sem alertas, título sem contador (158 ms): `01-fila-vazia.png`
3. ok: Opções desligadas: chamado só aparece no app (141 ms)
4. ok: Ativar pelo menu; aba visível toca som sem notificação (1184 ms): `02-preferencias-ligadas.png`
5. ok: Aba oculta: notificação com nome, sem mensagem; som curto é iniciado (1097 ms): `03-chamado-e-contador.png`
6. ok: Evento de clique foca a aba e abre a conversa do contato (220 ms): `04-conversa-do-alerta.png`
7. ok: Recarregar conserva opções e não repete alertas (1357 ms)
8. ok: Queda real do WebSocket: chamado durante a queda não alerta ao reconectar (3025 ms)
9. ok: Desligar as duas opções impede novos alertas (2289 ms)
10. ok: Assumir todos pelo sino: contador e título voltam a zero (1156 ms): `05-todos-assumidos.png`
11. ok: Sair restaura o título padrão (303 ms)
12. ok: Estado final no banco (127 ms)

#### Estado final observado

Notificações reais do Chromium, interceptadas após criação:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Caio Oculto",
    "tag": "ticket-3",
    "visibility": "hidden"
  }
]
```

Alertas depois do reload e da reconexão:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Davi Depois",
    "tag": "ticket-4",
    "visibility": "hidden"
  },
  {
    "title": "Chamado recebido",
    "body": "Fábio Depois",
    "tag": "ticket-6",
    "visibility": "hidden"
  }
]
```

Estado final no banco, setor 1:

```json
[
  {
    "status": "in_progress",
    "total": 8
  }
]
```

## Jornada alerts-settings: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:23.754Z, duração 5 s.

#### Passos

1. ok: Preparar supervisor com número desconectado (382 ms)
2. ok: Sem prompt ao abrir; solicitar só ao ativar e explicar permissão negada (432 ms): `01-permissao-negada.png`
3. ok: No celular de 375 px e no tema escuro o motivo permanece acessível (717 ms): `02-mobile-escuro.png`
4. ok: Contexto inseguro explica HTTPS e mantém o som disponível (962 ms): `03-contexto-inseguro.png`
5. ok: Título inclui número desconectado; conectar zera, sair restaura o título (634 ms): `04-logout-titulo-normal.png`
6. ok: Estado final no banco (230 ms)

#### Estado final observado

Estado final no banco, setor 4:

```json
[]
```

Conexão do setor:

```json
[
  {
    "connection_status": "disconnected"
  }
]
```

## Jornada alerts-tabs: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:12.697Z, duração 7 s.

#### Passos

1. ok: Preparar setor e uma sessão com duas abas (435 ms)
2. ok: Duas abas ligadas: apenas uma notifica o mesmo chamado (1350 ms)
3. ok: Desligar as opções na primeira aba, sem abrir o menu na segunda (2531 ms): `01-opcoes-desligadas.png`, `02-segunda-aba-apos-desligar.png`
4. ok: Estado final no banco e verificação de que a opção desligada vale nas duas abas (142 ms)

#### Estado final observado

Alerta inicial em cada aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-9",
      "visibility": "hidden"
    }
  ]
}
```

Alertas efetivos após desligar nas Configurações:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-9",
      "visibility": "hidden"
    }
  ],
  "somPrimeira": 0,
  "somSegunda": 1,
  "armazenamento": {
    "browser": null,
    "sound": null
  }
}
```

Estado final no banco, setor 2:

```json
[
  {
    "status": "queued",
    "total": 2
  }
]
```

## Jornada alerts-tabs-return: FALHOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:45.505Z, duração 8 s.

#### Passos

1. ok: Preparar duas abas com notificações ligadas (405 ms)
2. FALHOU: Voltar a uma aba antes dos 500 ms; a outra deve permanecer sem notificar (2835 ms): `01-primeira-aba-visivel.png`, `02-segunda-aba-notificou.png`

#### Falha

```text
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 3

- Array []
+ Array [
+   "Retorno Duas Abas",
+ ]
    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toEqual (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:59:59
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:18:3
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-200427/alerts-tabs-return.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422       11942         508        1727        5032        3480
Swap:           2047        2041           6

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2090416 521120  97876 5055816   26   87  7789   900 8160    7  7  3 88  3  0  0
 0  0 2090416 520824  97876 5056192    0    0     0     0 6404 7743  3  1 96  0  0  0
 0  0 2090416 519148  97876 5046984    0    0    60    64 8040 10498  4  3 93  0  0  0
```

#### Estado final observado

Notificações e retorno à aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Retorno Duas Abas",
      "tag": "ticket-14",
      "visibility": "hidden"
    }
  ],
  "visibilidadePrimeira": "visible",
  "criacaoNaSegunda": {
    "at": 1793747148407,
    "visibleSince": "1793747148047"
  }
}
```

Estado final no banco, setor 9:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```

## Jornada alerts-visibility: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:19.994Z, duração 3 s.

#### Passos

1. ok: Preparar atendente com notificação ativada (404 ms)
2. ok: Aba fica visível assim que o novo chamado aparece, antes dos 500 ms (1204 ms): `01-aba-visivel.png`
3. ok: Estado final no banco; aba já visível não deve notificar (123 ms)

#### Estado final observado

Visibilidade no momento de criar a notificação:

```json
[]
```

Estado final no banco, setor 3:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```

## Jornada connection: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:34.424Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (384 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (437 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (270 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (345 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (389 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (397 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1265 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (618 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (793 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (248 ms)

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
    "actor": "Supervisor 134425514"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `6d09eea59c8481dc0d02acff74a03af62b0373ba`, início 2026-11-03T23:05:28.796Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (630 ms)
2. ok: Atendente entra e vê a fila vazia (114 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (193 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (138 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (236 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (263 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (193 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (281 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (204 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (964 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (603 ms)

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
  "protocol": "2026-000012",
  "status": "in_progress",
  "assignee": "Atendente1 128797798",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 128797798"
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
