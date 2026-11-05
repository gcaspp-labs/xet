# Verificação run-20261104-221510

- Commit: `e63d43b3795017285716598cb3106836e2b2530e` (branch `task/48-tela-do-dashboard-do-atendimento`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 22:15:12 -0300
- Resumo gerado em: 2026-11-04 22:17:03 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| dashboard-ui (fora do mapa) | PASSOU | 19 | `evidence/dashboard-ui/` |

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

- Linhas de erro no log do backend: 3, sendo 3 de requisição cancelada pelo cliente.
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-221510/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 64 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-221510/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:15:52.664Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (655 ms)
2. ok: Atendente assume o chamado (355 ms)
3. ok: Formulário vazio não encerra e diz o que falta (465 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (866 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (973 ms)
6. ok: Fim antes do início é recusado (146 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (661 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (153 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (416 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (353 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (1051 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (281 ms)

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
  "organization": "Prefeitura 352665593",
  "closed_by": "Atendente1 352664942",
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
    "actor": "Atendente1 352664942"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 352664942"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 352664942"
  }
]
```

Chamado novo depois do encerramento:

```json
{
  "id": 6,
  "status": "queued"
}
```

## Jornada connection: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:01.419Z, duração 7 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (550 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (489 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (313 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (380 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (456 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (373 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1417 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (710 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (991 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (269 ms)

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
    "actor": "Supervisor 361420214"
  }
]
```

## Jornada dashboard-ui: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:15:31.327Z, duração 21 s.

#### Passos

1. ok: Preparar setores, dois atendentes, módulos e órgão (891 ms)
2. ok: Supervisor entra pelo menu e vê só o próprio setor (568 ms): `01-supervisor-proprio-setor.png`
3. ok: Atendente não vê o menu e endereço o devolve ao painel (277 ms)
4. ok: Assumir no painel atualiza dashboard sem recarregar (372 ms): `02-atendimento-tempo-real.png`
5. ok: Preparar encerrado registrado para os filtros (295 ms)
6. ok: Mensagem nova atualiza fila e recebidos sem recarregar (207 ms): `03-novo-chamado-tempo-real.png`
7. ok: Datas mudam números do período e mantêm fila atual (684 ms)
8. ok: Atendente e módulo mudam números e mostram não aplicáveis (1829 ms): `04-filtro-modulo.png`
9. ok: Órgão filtra e filtros sobrevivem ao recarregar (1291 ms)
10. ok: Administrador alterna setores e limpa filtros dependentes (1528 ms): `05-administrador-todos-setores.png`
11. ok: Sem rolagem horizontal: 1280px, Claro, texto Padrão (882 ms): `06-dashboard-1280-Claro-Padrão.png`
12. ok: Sem rolagem horizontal: 1280px, Claro, texto Maior (992 ms): `07-dashboard-1280-Claro-Maior.png`
13. ok: Sem rolagem horizontal: 1280px, Escuro, texto Padrão (930 ms): `08-dashboard-1280-Escuro-Padrão.png`
14. ok: Sem rolagem horizontal: 1280px, Escuro, texto Maior (932 ms): `09-dashboard-1280-Escuro-Maior.png`
15. ok: Sem rolagem horizontal: 375px, Claro, texto Padrão (1376 ms): `10-dashboard-375-Claro-Padrão.png`
16. ok: Sem rolagem horizontal: 375px, Claro, texto Maior (1333 ms): `11-dashboard-375-Claro-Maior.png`
17. ok: Sem rolagem horizontal: 375px, Escuro, texto Padrão (1305 ms): `12-dashboard-375-Escuro-Padrão.png`
18. ok: Sem rolagem horizontal: 375px, Escuro, texto Maior (1213 ms): `13-dashboard-375-Escuro-Maior.png`
19. ok: Estado final no banco corresponde ao dashboard (158 ms)

#### Estado final observado

Chamados dos setores:

```json
[
  {
    "sector_id": 1,
    "status": "closed",
    "total": 1
  },
  {
    "sector_id": 1,
    "status": "queued",
    "total": 2
  },
  {
    "sector_id": 2,
    "status": "queued",
    "total": 1
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:08.965Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (799 ms)
2. ok: Atendente entra e vê a fila vazia (119 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (214 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (160 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (264 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (354 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (210 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (343 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (227 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1376 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (658 ms)

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
  "protocol": "2026-000008",
  "status": "in_progress",
  "assignee": "Atendente1 368965740",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 368965740"
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

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:16.287Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (609 ms)
2. ok: Sem assumir, não há como responder (459 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (160 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (373 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (311 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (91 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (220 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (235 ms)
9. ok: Pela API, quem não é responsável também é recusado (302 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (458 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (339 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (278 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (179 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 12,
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

Commit `e63d43b3795017285716598cb3106836e2b2530e`, início 2026-11-05T01:16:22.674Z, duração 12 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1406 ms)
2. ok: Atendente assume o chamado (357 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (343 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1103 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (300 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (20 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1175 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (285 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (623 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1878 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (838 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
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
  "assignee": "Atendente1 382674428",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 382674428",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 21,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 382674428",
    "changes": {
      "assignee_id": {
        "to": 22,
        "from": 21
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 382674428",
    "changes": {
      "assignee_id": {
        "to": 21,
        "from": 22
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 382674428",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 382675078",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 12,
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
