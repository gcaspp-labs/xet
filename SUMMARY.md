# Verificação run-20261105-132118

- Commit: `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4` (branch `task/87-admin-sem-notificacao-chamados`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 13:21:21 -0300
- Resumo gerado em: 2026-11-05 13:22:37 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| revisao-t87 (fora do mapa) | PASSOU | 11 | `evidence/revisao-t87/` |

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
- Log: `.verify-app/runs/run-20261105-132118/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 29 arquivo(s) em .verify-app/runs/run-20261105-132118/evidence.

## Detalhe de cada jornada

## Jornada connection: PASSOU

Commit `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4`, início 2026-11-05T16:22:06.445Z, duração 8 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (531 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (576 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (312 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (428 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (498 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (435 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1224 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (812 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (1215 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (280 ms)

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
    "actor": "Supervisor 726445694"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4`, início 2026-11-05T16:21:58.584Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (930 ms)
2. ok: Atendente entra e vê a fila vazia (222 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (247 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (155 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (327 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (367 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (266 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (337 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (221 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1615 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (672 ms)

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
  "assignee": "Atendente1 718585496",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 718585496"
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

## Jornada revisao-t87: PASSOU

Commit `1a4bdbbeb3114e717a645800f6ecbb0c7de0f2e4`, início 2026-11-05T16:21:44.285Z, duração 14 s.

#### Passos

1. ok: Preparar dois setores conectados com usuários próprios (618 ms)
2. ok: Administrador com preferências antigas salvas não vê alerta da fila existente (943 ms): `01-admin-sino-vazio-com-fila.png`
3. ok: Menu do administrador sem Alertas; tema, acessibilidade, Usuários e Sair presentes (423 ms): `02-admin-menu-sem-alertas.png`
4. ok: Supervisor mantém preferências, lista e contador do próprio setor (1261 ms): `03-supervisor-sino.png`
5. ok: Atendente mantém preferências, lista e contador do próprio setor (1086 ms): `04-atendente-sino.png`
6. ok: Chamado novo alerta supervisor e atendente; administrador recebe só a fila no painel (2600 ms): `05-admin-nova-fila-sem-alertas.png`
7. ok: Administrador troca o setor no painel e assume o chamado pela fila (1012 ms): `06-admin-assumiu-pelo-painel.png`
8. ok: Número desconectado conta sozinho no sino e título do administrador (462 ms): `07-admin-so-numero-desconectado.png`
9. ok: Preparar novo pareamento: celular desvincula a conta, exigindo QR code (218 ms)
10. ok: Reconectar o número limpa contador e título apesar das filas restantes (304 ms): `08-admin-reconectou.png`
11. ok: Estado final no banco: filas preservadas, administrador responsável e auditoria única (607 ms)

#### Estado final observado

Chamado novo: efeitos observados:

```json
{
  "administrador": {
    "notifications": [],
    "beeps": 0
  },
  "supervisor": {
    "notifications": [
      {
        "title": "Chamado recebido",
        "body": "Nova Revisão"
      }
    ],
    "beeps": 1
  },
  "atendente": {
    "notifications": [
      {
        "title": "Chamado recebido",
        "body": "Nova Revisão"
      }
    ],
    "beeps": 1
  }
}
```

Chamados:

```json
[
  {
    "name": "Antiga Revisão",
    "status": "queued",
    "assignee_id": null
  },
  {
    "name": "Nova Revisão",
    "status": "in_progress",
    "assignee_id": 1
  },
  {
    "name": "Outro Setor Revisão",
    "status": "queued",
    "assignee_id": null
  }
]
```

Auditoria da atribuição:

```json
[
  {
    "action": "ticket_assigned",
    "actor_id": 1
  }
]
```
