# Verificação run-20261105-122301

- Commit: `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb` (branch `task/86-ajustes-visuais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 12:23:03 -0300
- Resumo gerado em: 2026-11-05 12:31:42 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | PASSOU | 12 | `evidence/close/` |
| connection | PASSOU | 10 | `evidence/connection/` |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| preparar-testes-t86 (fora do mapa) | PASSOU | 2 | `evidence/preparar-testes-t86/` |
| revisao-t86 (fora do mapa) | PASSOU | 14 | `evidence/revisao-t86/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-122301/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 72 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261105-122301/evidence.

## Detalhe de cada jornada

## Jornada close: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:23:39.806Z, duração 8 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (684 ms)
2. ok: Atendente assume o chamado (353 ms)
3. ok: Formulário vazio não encerra e diz o que falta (482 ms): `01-formulario-incompleto.png`
4. ok: Com o contato sem cadastro, o backend recusa o encerramento (983 ms): `02-contato-sem-cadastro.png`
5. ok: Atendente cadastra o contato pelo próprio formulário (535 ms)
6. ok: Fim antes do início é recusado (134 ms)
7. ok: Com tudo certo, encerra e volta ao painel com o atendimento nos realizados (555 ms): `03-formulario-completo.png`, `04-painel-realizados.png`
8. ok: Supervisor vê o atendimento nos realizados, sem recarregar (107 ms): `05-supervisor-realizados.png`
9. ok: Chamado encerrado mostra o registro e não aceita resposta (410 ms): `06-chamado-encerrado.png`
10. ok: Nova mensagem do cliente abre outro chamado, sem reabrir (384 ms): `07-novo-chamado-na-fila.png`
11. ok: Cancelamento direto da fila exige motivo e dispensa o cadastro (909 ms): `08-cancelamento.png`, `09-cancelado-nos-realizados.png`
12. ok: Estado final do encerramento no banco (264 ms)

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
  "organization": "Prefeitura 219807721",
  "closed_by": "Atendente1 219806695",
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
    "actor": "Atendente1 219806695"
  },
  {
    "action": "ticket_organization_linked",
    "actor": "Atendente1 219806695"
  },
  {
    "action": "ticket_closed",
    "actor": "Atendente1 219806695"
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

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:23:48.117Z, duração 7 s.

#### Passos

1. ok: Preparar setor nunca conectado, com supervisor e atendente (491 ms)
2. ok: Número nunca conectado: o sino avisa e leva à tela de conexão (419 ms): `01-aviso-no-sino.png`, `02-nunca-conectado.png`
3. ok: Conectar mostra o QR code, que troca sozinho (286 ms): `03-qr-code.png`
4. ok: Celular lê o QR code: a tela mostra o número conectado, sem recarregar (365 ms): `04-conectado.png`
5. ok: Queda da conexão: o item aparece no sino, sem recarregar (375 ms): `05-queda-no-sino.png`
6. ok: Desvinculado pelo celular: a tela pede um novo QR code (406 ms): `06-requer-qr-code.png`
7. ok: Reconecta e desvincula pela tela, com confirmação (1178 ms): `07-confirmar-desvinculo.png`, `08-desvinculado.png`
8. ok: Número já ligado a outro setor é recusado, com o motivo na tela (724 ms): `09-numero-de-outro-setor.png`
9. ok: Atendente não vê a conexão nem o aviso no sino, e a rota o devolve ao painel (1129 ms): `10-atendente-sem-conexao.png`
10. ok: Estado final no banco, com a auditoria da conexão (321 ms)

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
    "actor": "Supervisor 228118535"
  }
]
```

## Jornada preparar-testes-t86: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:27:20.674Z, duração 1 s.

#### Passos

1. ok: Preparar administrador fictício para executar os testes do PR na instância isolada (135 ms)
2. ok: Confirmar papel no banco (123 ms)

#### Estado final observado

Administrador dos testes:

```json
[
  {
    "role": "admin",
    "active": true
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:23:55.604Z, duração 7 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (861 ms)
2. ok: Atendente entra e vê a fila vazia (144 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (240 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (143 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (265 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (335 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (216 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (351 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (232 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1413 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (717 ms)

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
  "assignee": "Atendente1 235604534",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 235604534"
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

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:24:03.106Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (608 ms)
2. ok: Sem assumir, não há como responder (268 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (198 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (370 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (280 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (111 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (235 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (296 ms)
9. ok: Pela API, quem não é responsável também é recusado (298 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (470 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (338 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (360 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (133 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 8,
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

## Jornada revisao-t86: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:25:50.317Z, duração 15 s.

#### Passos

1. ok: Preparar setor conectado, módulos e dois chamados fictícios (671 ms)
2. ok: Sem preferência, as duas seções começam abertas e os números carregam (297 ms): `01-dashboard-inicial.png`
3. ok: Select com escolha abre abaixo em tela cheia; clique, teclado e Escape funcionam (968 ms): `02-select-tela-abaixo.png`
4. ok: Select no fim da tela abre acima sem cobrir o campo (378 ms): `03-select-tela-acima.png`
5. ok: Recolher preserva títulos, datas, filtros e tabela com dados (1009 ms): `04-duas-recolhidas-filtros-tabela.png`
6. ok: Preferência sobrevive ao reload; reabrir por Espaço e clique mantém independência (627 ms)
7. ok: Select em janela abre abaixo e escolhe por clique e teclado (1256 ms): `05-select-janela-abaixo.png`
8. ok: Select em janela curta abre acima e escolhe sem fechar a janela (825 ms): `06-select-janela-acima.png`
9. ok: Claro, desktop, texto Maior: dashboard, lista e sino sem rolagem horizontal (1354 ms): `07-Claro-1280-dashboard.png`, `08-Claro-1280-lista.png`, `09-Claro-1280-sino.png`
10. ok: Claro, celular, texto Maior: dashboard, lista e sino sem rolagem horizontal (1147 ms): `10-Claro-375-dashboard.png`, `11-Claro-375-lista.png`, `12-Claro-375-sino.png`
11. ok: Escuro, desktop, texto Maior: dashboard, lista e sino sem rolagem horizontal (1400 ms): `13-Escuro-1280-dashboard.png`, `14-Escuro-1280-lista.png`, `15-Escuro-1280-sino.png`
12. ok: Escuro, celular, texto Maior: dashboard, lista e sino sem rolagem horizontal (1079 ms): `16-Escuro-375-dashboard.png`, `17-Escuro-375-lista.png`, `18-Escuro-375-sino.png`
13. ok: Armazenamento bloqueado: recolher funciona, persiste na navegação e reinicia aberto no reload (1551 ms)
14. ok: Estado final do banco: somente a ação de assumir alterou os chamados (299 ms)

#### Estado final observado

Filtros e tabela preservados:

```json
{
  "url": "http://127.0.0.1:25173/dashboard?period=7d",
  "table": "Por atendente\nATENDENTE\tEM ATENDIMENTO\tINICIADOS\tENCERRADOS\tTRANSFERIDOS\tCANCELADOS\tTEMPO MÉDIO DE ATENDIMENTO\nSupervisor 350317185\t1\t0\t0\t0\t0\t—",
  "dates": "30/10/2026 a 05/11/2026"
}
```

Chamados fictícios no banco:

```json
[
  {
    "status": "in_progress",
    "assignee_id": 20
  },
  {
    "status": "queued",
    "assignee_id": null
  }
]
```

Auditoria:

```json
[
  {
    "action": "ticket_assigned"
  }
]
```

## Jornada transfer: PASSOU

Commit `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`, início 2026-11-05T15:24:09.367Z, duração 12 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1394 ms)
2. ok: Atendente assume o chamado (337 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (333 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (1056 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (359 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (17 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (1071 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (267 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (549 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (2063 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (861 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
12. ok: Estado final da transferência entre setores no banco (258 ms)

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
  "assignee": "Atendente1 249368097",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 249368097",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 16,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 249368097",
    "changes": {
      "assignee_id": {
        "to": 17,
        "from": 16
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 249368097",
    "changes": {
      "assignee_id": {
        "to": 16,
        "from": 17
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 249368097",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 249369217",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 8,
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

## Testes do PR executados pelo revisor

40 testes ponta a ponta passaram (2,2 minutos), 1 worker e 0 retries, nos quatro arquivos afetados, sem modificar seus testes. Veja [log completo](E2E.md) e [jornada específica](JORNADA.md).

As duas linhas de erro do backend foram `context canceled`, durante a navegação/fechamento de páginas dos testes. Não houve outro erro; esse registro de cancelamento pelo cliente é explicado na skill verify-app.

As 61 capturas das jornadas foram conferidas antes de publicar; contêm somente a instância isolada e dados fictícios. Capturas nos temas claro e escuro, desktop e celular de 375 px, com texto Maior, estão em revisao-t86. Toque em aparelho físico não foi testado e não é um critério da T86.

Na consulta de 05/11/2026, lint, código gerado e backend passaram no CI; o job de ponta a ponta ainda estava em andamento. Isso continua pendente para o merge.
