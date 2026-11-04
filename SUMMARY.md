# Verificação run-20261103-221455

- Commit: `68c4573079db3550e657f0b1b66102881c14e84b` (branch `task/46-tamanho-do-texto-e-alto-contraste`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-03 22:14:57 -0300
- Resumo gerado em: 2026-11-03 22:17:57 -0300
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
| accessibility-toast (fora do mapa) | PASSOU | 7 | `evidence/accessibility-toast/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-221455/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 71 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-221455/evidence.

## Detalhe de cada jornada

## Jornada accessibility: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:38.182Z, duração 11 s.

#### Passos

1. ok: Preparar setor, módulos e dois chamados (433 ms)
2. ok: Tamanhos Padrão, Grande e Maior mudam o texto e persistem (1444 ms): `01-painel-maior.png`
3. ok: Alto contraste e tamanho aplicados antes do JavaScript do app (547 ms)
4. ok: Preferências chegam a outra aba com o menu fechado (1208 ms)
5. ok: Painel, menu e sino medidos em 7:1 — Claro (781 ms): `02-menu-Claro.png`, `03-sino-Claro.png`
6. ok: Painel, menu e sino medidos em 7:1 — Escuro (776 ms): `04-menu-Escuro.png`, `05-sino-Escuro.png`
7. ok: Abrir e assumir em Maior, título e ações acessíveis (376 ms): `06-conversa-maior.png`
8. ok: Conversa, campos, status e encerramento com erros — Claro (808 ms): `07-encerramento-Claro.png`
9. ok: Conversa, campos, status e encerramento com erros — Escuro (754 ms): `08-encerramento-Escuro.png`
10. ok: 375px, Maior: conversa, sino e encerramento sem rolagem horizontal (565 ms): `09-celular-conversa.png`, `10-celular-sino.png`, `11-celular-encerramento.png`
11. ok: Número desconectado com palavra e contraste nos dois temas (1300 ms): `12-desconectado-Claro.png`, `13-conexao-Claro.png`, `14-desconectado-Escuro.png`, `15-conexao-Escuro.png`
12. ok: Sistema escuro e claro forçado preservam alto contraste (467 ms)
13. ok: Estado final no banco: chamado e mensagem preservados (120 ms)

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
  "measured": 73
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
    "id": 4,
    "status": "in_progress",
    "assignee_id": 4
  },
  {
    "id": 5,
    "status": "queued",
    "assignee_id": null
  }
]
```

## Jornada accessibility-toast: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:33.885Z, duração 4 s.

#### Passos

1. ok: Preparar setor conectado (474 ms)
2. ok: Aviso acompanha o tamanho Padrão (540 ms): `01-aviso-Padrão.png`
3. ok: Aviso acompanha o tamanho Grande (531 ms): `02-aviso-Grande.png`
4. ok: Aviso acompanha o tamanho Maior (511 ms): `03-aviso-Maior.png`
5. ok: Aviso cresce 15% e 30% sobre Padrão (1 ms)
6. ok: 375px em Maior: aviso com ação cabe e o link também cresce (781 ms): `04-celular-maior-com-acao.png`, `05-conversa-aberta-pelo-aviso.png`
7. ok: Estado final no banco: três chamados, um assumido (121 ms)

#### Estado final observado

Padrão:

```json
{
  "toast": 13,
  "body": "14px"
}
```

Grande:

```json
{
  "toast": 14.95,
  "body": "16.1px"
}
```

Maior:

```json
{
  "toast": 16.9,
  "body": "18.2px"
}
```

Aviso com ação no celular:

```json
{
  "size": 16.9,
  "actionSize": 17.55,
  "box": {
    "x": 16,
    "y": 659.3367309570312,
    "width": 343,
    "height": 60.3125
  },
  "linkBox": {
    "x": 222,
    "y": 671.0186767578125,
    "width": 120,
    "height": 26.3125
  }
}
```

Chamados:

```json
[
  {
    "status": "queued",
    "assignee_id": null
  },
  {
    "status": "queued",
    "assignee_id": null
  },
  {
    "status": "in_progress",
    "assignee_id": 3
  }
]
```

## Jornada close: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:49.054Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (513 ms)
2. ok: Atendente assume o chamado (299 ms)
3. ok: Formulário vazio não encerra e diz o que falta (401 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (925 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (502 ms)
6. ok: Fim antes do início é recusado (128 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (512 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (96 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (307 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (336 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1068 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (250 ms)

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
  "organization": "Prefeitura 009055741",
  "closed_by": "Atendente1 009054044",
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
    "actor": "Atendente1 009054044"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 009054044"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 009054044"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 7,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:16:56.150Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (412 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (465 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (260 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (360 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (355 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (427 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1340 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (613 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (781 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (247 ms)

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
    "actor": "Supervisor 016151291"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:17:02.650Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (638 ms)
2. ok: Atendente entra e vê a fila vazia (137 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (159 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (129 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (252 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (311 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (181 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (228 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (169 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1033 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (608 ms)

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
  "protocol": "2026-000009",
  "status": "in_progress",
  "assignee": "Atendente1 022651146",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 022651146"
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

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:17:08.296Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (450 ms)
2. ok: Sem assumir, não há como responder (376 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (173 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (250 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (288 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (97 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (203 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (259 ms)
9. ok: Pela API, quem não é responsável também é recusado (266 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (414 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (290 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (306 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (141 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 13,
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

Commit `68c4573079db3550e657f0b1b66102881c14e84b`, início 2026-11-04T01:17:13.333Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1119 ms)
2. ok: Atendente assume o chamado (436 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (279 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1098 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (291 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (24 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (946 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (248 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (438 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1521 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (767 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (236 ms)

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
  "assignee": "Atendente1 033334031",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 033334031",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 20,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 033334031",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 20
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 033334031",
    "changes": {
      "assignee_id": {
        "to": 20,
        "from": 21
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 033334031",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 033335778",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 13,
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
