# Verificação run-20261103-202848

- Commit: `e4211912fdf6e431cd23829584516ebaa46077b9` (branch `task/45-alertas-do-navegador-e-som`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-03 20:28:50 -0300
- Resumo gerado em: 2026-11-03 20:31:13 -0300
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
| alerts-tabs-return (fora do mapa) | PASSOU | 6 | `evidence/alerts-tabs-return/` |
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

- Linhas de erro no log do backend: 2, sendo 2 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-202848/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 41 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-202848/evidence.

## Detalhe de cada jornada

## Jornada alerts: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:06.229Z, duração 14 s.

#### Passos

1. ok: Preparar setor conectado e atendente (437 ms)
2. ok: Entrar sem pedir permissão, sem alertas, título sem contador (191 ms): `01-fila-vazia.png`
3. ok: Opções desligadas: chamado só aparece no app (111 ms)
4. ok: Ativar pelo menu; aba visível toca som sem notificação (1103 ms): `02-preferencias-ligadas.png`
5. ok: Aba oculta: notificação com nome, sem mensagem; som curto é iniciado (1100 ms): `03-chamado-e-contador.png`
6. ok: Evento de clique foca a aba e abre a conversa do contato (138 ms): `04-conversa-do-alerta.png`
7. ok: Recarregar conserva opções e não repete alertas (1285 ms)
8. ok: Queda real do WebSocket: chamado durante a queda não alerta ao reconectar (3923 ms)
9. ok: Desligar as duas opções impede novos alertas (2448 ms)
10. ok: Assumir todos pelo sino: contador e título voltam a zero (1143 ms): `05-todos-assumidos.png`
11. ok: Sair restaura o título padrão (290 ms)
12. ok: Estado final no banco (124 ms)

#### Estado final observado

Notificações reais do Chromium, interceptadas após criação:

```json
[
  {
    "title": "Chamado recebido",
    "body": "Caio Oculto",
    "tag": "ticket-7",
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
    "tag": "ticket-8",
    "visibility": "hidden"
  },
  {
    "title": "Chamado recebido",
    "body": "Fábio Depois",
    "tag": "ticket-10",
    "visibility": "hidden"
  }
]
```

Estado final no banco, setor 2:

```json
[
  {
    "status": "in_progress",
    "total": 8
  }
]
```

## Jornada alerts-settings: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:31.647Z, duração 5 s.

#### Passos

1. ok: Preparar supervisor com número desconectado (383 ms)
2. ok: Sem prompt ao abrir; solicitar só ao ativar e explicar permissão negada (548 ms): `01-permissao-negada.png`
3. ok: No celular de 375 px e no tema escuro o motivo permanece acessível (806 ms): `02-mobile-escuro.png`
4. ok: Contexto inseguro explica HTTPS e mantém o som disponível (968 ms): `03-contexto-inseguro.png`
5. ok: Título inclui número desconectado; conectar zera, sair restaura o título (647 ms): `04-logout-titulo-normal.png`
6. ok: Estado final no banco (232 ms)

#### Estado final observado

Estado final no banco, setor 5:

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

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:20.220Z, duração 7 s.

#### Passos

1. ok: Preparar setor e uma sessão com duas abas (414 ms)
2. ok: Duas abas ligadas: apenas uma notifica o mesmo chamado (1348 ms)
3. ok: Desligar as opções na primeira aba, sem abrir o menu na segunda (2594 ms): `01-opcoes-desligadas.png`, `02-segunda-aba-apos-desligar.png`
4. ok: Estado final no banco e verificação de que a opção desligada vale nas duas abas (163 ms)

#### Estado final observado

Alerta inicial em cada aba:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Iara Única",
      "tag": "ticket-13",
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
      "tag": "ticket-13",
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

Estado final no banco, setor 3:

```json
[
  {
    "status": "queued",
    "total": 2
  }
]
```

## Jornada alerts-tabs-return: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:29:48.453Z, duração 12 s.

#### Passos

1. ok: Preparar duas abas com notificações e som ligados (432 ms)
2. ok: Retorno antes dos 500 ms cancela a notificação na outra aba; som único (2629 ms): `01-retorno-aba-visivel.png`, `02-outra-aba-sem-notificar.png`
3. ok: Aba visível recebe a fila 1,5 s depois; a outra não notifica e som segue único (2809 ms): `03-aba-visivel-lenta.png`
4. ok: Ocultar ambas restaura uma notificação e um som por chamado (1697 ms)
5. ok: Fechar a aba visível libera a trava; aba restante volta a notificar (1108 ms): `04-aba-visivel-fechada.png`
6. ok: Estado final no banco (131 ms)

#### Estado final observado

Retorno, som e notificações:

```json
{
  "visibilidade": "visible",
  "som": 1,
  "notificacoes": []
}
```

Aba lenta:

```json
{
  "som": 2,
  "notificacoes": []
}
```

Notificações registradas durante toda a jornada:

```json
{
  "primeira": [],
  "segunda": [
    {
      "title": "Chamado recebido",
      "body": "Controle Ocultas",
      "tag": "ticket-3",
      "visibility": "hidden"
    }
  ],
  "som": 3
}
```

Estado final no banco, setor 1:

```json
[
  {
    "status": "queued",
    "total": 4
  }
]
```

## Jornada alerts-visibility: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:27.761Z, duração 4 s.

#### Passos

1. ok: Preparar atendente com notificação ativada (440 ms)
2. ok: Aba fica visível assim que o novo chamado aparece, antes dos 500 ms (1206 ms): `01-aba-visivel.png`
3. ok: Estado final no banco; aba já visível não deve notificar (135 ms)

#### Estado final observado

Visibilidade no momento de criar a notificação:

```json
[]
```

Estado final no banco, setor 4:

```json
[
  {
    "status": "queued",
    "total": 1
  }
]
```

## Jornada connection: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:42.642Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (382 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (557 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (296 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (322 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (394 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (383 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1283 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (568 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (808 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (235 ms)

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
    "actor": "Supervisor 642643739"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `e4211912fdf6e431cd23829584516ebaa46077b9`, início 2026-11-03T23:30:36.891Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (649 ms)
2. ok: Atendente entra e vê a fila vazia (135 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (165 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (158 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (273 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (296 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (200 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (279 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (178 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1061 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (609 ms)

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
  "protocol": "2026-000016",
  "status": "in_progress",
  "assignee": "Atendente1 636891381",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 636891381"
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
