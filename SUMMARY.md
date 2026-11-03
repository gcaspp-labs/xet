# Verificação run-20261103-180135

- Commit: `0a03a2d659c2c5cb93717d0598640c9d530ec6d2` (branch `task/44-sino-de-notificacoes`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-03 18:01:37 -0300
- Resumo gerado em: 2026-11-03 18:04:08 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| notifications (fora do mapa) | PASSOU | 22 | `evidence/notifications/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-180135/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 74 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261103-180135/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:39.873Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (516 ms)
2. ok: Atendente assume o chamado (289 ms)
3. ok: Formulário vazio não encerra e diz o que falta (393 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (794 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (483 ms)
6. ok: Fim antes do início é recusado (136 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (447 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (99 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (326 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (326 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (989 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (249 ms)

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
  "organization": "Prefeitura 819875708",
  "closed_by": "Atendente1 819874727",
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
    "actor": "Atendente1 819874727"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 819874727"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 819874727"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 28,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:12.715Z, duração 6 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (424 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (497 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (265 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (362 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (442 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (334 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1335 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (665 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (863 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (266 ms)

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
    "actor": "Supervisor 792716635"
  }
]
```

## Jornada notifications: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:02:35.845Z, duração 23 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (646 ms)
2. ok: Primeira carga: mostra o que já estava na fila, sem aviso (1628 ms): `01-primeira-carga.png`
3. ok: Chamado novo sobe o contador, avisa sem botão e mostra o item, sem recarregar (636 ms): `02-aviso-e-contador.png`, `03-lista-do-sino.png`
4. ok: Recarregar a página não repete o aviso (1689 ms)
5. ok: "Abrir" leva à conversa, e o chamado segue na fila (370 ms)
6. ok: Assumir pelo sino não muda a tela nem apaga o texto em digitação (740 ms): `04-assumido-sem-mudar-tela.png`
7. ok: Outra pessoa assume: o item sai (557 ms)
8. ok: Devolvido à fila: o item volta (1196 ms): `05-devolvido-volta-ao-sino.png`
9. ok: Outra pessoa cancela: o item sai (716 ms): `06-sino-vazio.png`
10. ok: Quem perde a disputa vê o erro dentro da lista (1125 ms): `07-erro-na-lista.png`
11. ok: Rede cai e volta: o chamado da queda aparece, sem aviso (548 ms): `08-volta-da-rede.png`
12. ok: WebSocket cai e reconecta: o chamado da queda aparece, sem aviso (3933 ms): `09-websocket-caido.png`, `10-websocket-de-volta.png`
13. ok: Atendente de outro setor não vê o chamado nem o número desconectado (795 ms): `11-atendente-outro-setor.png`
14. ok: Supervisor de outro setor não vê o número deste nem a faixa antiga (378 ms)
15. ok: Supervisor vê o número desconectado, em alerta, sem a faixa (531 ms): `12-contador-em-alerta-claro.png`, `13-item-numero-desconectado.png`, `14-item-numero-desconectado-escuro.png`, `15-contador-em-alerta-escuro.png`
16. ok: O item leva à tela do setor e só sai ao conectar (598 ms): `16-item-durante-conexao.png`, `17-conectado-sem-item.png`
17. ok: Número cai com a tela aberta: o item volta sem recarregar (56 ms)
18. ok: Administrador vê número desconectado, em alerta, e os setores identificados (797 ms): `18-administrador-varios-setores.png`, `19-administrador-tela-do-setor.png`, `20-administrador-queda-ao-vivo.png`
19. ok: Administrador recebe o aviso de um setor e assume pelo sino (396 ms)
20. ok: O sino aparece nas outras telas (607 ms)
21. ok: Funciona na largura do celular, com lista longa (1451 ms): `21-celular-cabecalho.png`, `22-celular-lista.png`, `23-celular-fim-da-lista.png`, `24-celular-assumido.png`
22. ok: Estado final no banco (239 ms)

#### Estado final observado

Avisos vistos pelo atendente até a devolução:

```json
[
  "Chamado recebido: Carla Fila"
]
```

Avisos na queda da rede:

```json
[
  "Chamado recebido: Gabi Antes",
  "Chamado recebido: Iara Depois"
]
```

Avisos na queda do WebSocket:

```json
[
  "Chamado recebido: Kelly Depois"
]
```

Chamados do setor:

```json
[
  {
    "contato": "Ana Antiga",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Bruno Novo",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Carla Fila",
    "status": "closed",
    "assignee_id": 2
  },
  {
    "contato": "Davi Disputado",
    "status": "in_progress",
    "assignee_id": 3
  },
  {
    "contato": "Gabi Antes",
    "status": "in_progress",
    "assignee_id": 4
  },
  {
    "contato": "Hugo Durante",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Iara Depois",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Joana Na Queda",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Kelly Depois",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Mario Admin",
    "status": "in_progress",
    "assignee_id": 1
  },
  {
    "contato": "Contato Longo 1",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 2",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 3",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 4",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 5",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 6",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 7",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 8",
    "status": "queued",
    "assignee_id": null
  },
  {
    "contato": "Contato Longo 9",
    "status": "queued",
    "assignee_id": null
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:19.343Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (619 ms)
2. ok: Atendente entra e vê a fila vazia (137 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (210 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (144 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (276 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (276 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (179 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (291 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (220 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1030 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (628 ms)

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
  "protocol": "2026-000021",
  "status": "in_progress",
  "assignee": "Atendente1 799344079",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 799344079"
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

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:25.039Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (463 ms)
2. ok: Sem assumir, não há como responder (267 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (147 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (278 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (228 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (101 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (201 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (258 ms)
9. ok: Pela API, quem não é responsável também é recusado (273 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (384 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (301 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (274 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (147 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 25,
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

Commit `0a03a2d659c2c5cb93717d0598640c9d530ec6d2`, início 2026-11-03T21:03:30.081Z, duração 9 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1111 ms)
2. ok: Atendente assume o chamado (311 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (231 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (989 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (270 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (23 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (995 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (252 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (400 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1561 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (625 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (249 ms)

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
  "assignee": "Atendente1 810082182",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 810082182",
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
    "actor": "Atendente1 810082182",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 20
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 810082182",
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
    "sector": "Setor 810082182",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 810083463",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 25,
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
