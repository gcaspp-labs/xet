# Verificação run-20261105-135934

- Commit: `d974df6ae5d5b4fce362b93ed23560e0abbaa762` (branch `task/88-apelido-nas-mensagens`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-05 13:59:36 -0300
- Resumo gerado em: 2026-11-05 14:00:38 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | PASSOU | 11 | `evidence/receive-and-assign/` |
| reply | PASSOU | 13 | `evidence/reply/` |
| transfer | PASSOU | 12 | `evidence/transfer/` |
| revisao-t88 (fora do mapa) | PASSOU | 11 | `evidence/revisao-t88/` |

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
- Log: `.verify-app/runs/run-20261105-135934/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 38 arquivo(s) em .verify-app/runs/run-20261105-135934/evidence.

## Detalhe de cada jornada

## Jornada receive-and-assign: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:05.922Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (626 ms)
2. ok: Atendente entra e vê a fila vazia (142 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (204 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (149 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (241 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai na conversa (300 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (210 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (302 ms)
9. ok: Painel mostra o chamado com o responsável, fora da fila (193 ms): `06-painel-em-atendimento.png`
10. ok: Outro setor não vê a fila nem abre o chamado (1104 ms): `07-outro-setor-nao-ve.png`
11. ok: Estado final no banco (643 ms)

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
  "protocol": "2026-000003",
  "status": "in_progress",
  "assignee": "Atendente1 005922154",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 005922154"
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

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:11.937Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (443 ms)
2. ok: Sem assumir, não há como responder (308 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (148 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (320 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (253 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (79 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (201 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (254 ms)
9. ok: Pela API, quem não é responsável também é recusado (283 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (465 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (318 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (284 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (109 ms)

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
    "body": "Atendente1 011938776: Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Atendente1 011938776: Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Atendente1 011938776: Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```

## Jornada revisao-t88: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T16:59:45.037Z, duração 12 s.

#### Passos

1. ok: Preparar setor conectado e atendente (464 ms)
2. ok: Cadastro sugere primeiro e último nome e para de acompanhar após edição manual (1109 ms): `01-sugestao-editada.png`
3. ok: Editar nome mantém apelido; vazio volta ao primeiro e último nome (1279 ms): `02-apelido-padrao-persistido.png`
4. ok: Apelido repetido ignora maiúsculas e mostra erro no formulário (1017 ms): `03-apelido-duplicado.png`
5. ok: Assumir e enviar texto com o apelido na conversa (650 ms): `04-texto-com-apelido.png`
6. ok: Repetição não duplica prefixo nem linha; texto vazio é recusado (276 ms)
7. ok: Imagem com legenda e documento sem legenda mostram o prefixo (596 ms): `05-imagem-com-legenda.png`, `06-documento-sem-legenda.png`
8. ok: Reenvio após trocar apelido preserva prefixo antigo; próxima mensagem usa o novo (1053 ms): `07-apelidos-antigo-e-novo.png`
9. ok: Áudio gravado com microfone simulado sai sem prefixo (2272 ms): `08-audio-sem-prefixo.png`
10. ok: Nova conversa envia primeira mensagem com apelido atual (848 ms): `09-primeira-mensagem.png`
11. ok: Estado final: textos, anexos, áudio, cadastro e auditoria no banco (365 ms)

#### Estado final observado

Mensagens:

```json
[
  {
    "origin": "customer",
    "type": "text",
    "body": "Mensagem sem prefixo",
    "status": null
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Atendente Revisão 1793897986669: Bom dia",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "image",
    "body": "Atendente Revisão 1793897986669: Comprovante fictício",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "document",
    "body": "Atendente Revisão 1793897986669:",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Atendente Revisão 1793897986669: Falha controlada",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "text",
    "body": "Novo Apelido 1793897986669: Depois da troca",
    "status": "sent"
  },
  {
    "origin": "agent",
    "type": "audio",
    "body": null,
    "status": "sent"
  }
]
```

Primeira mensagem:

```json
[
  {
    "body": "Novo Apelido 1793897986669: Primeiro contato"
  }
]
```

Auditoria do apelido:

```json
[
  {
    "action": "user_created",
    "changes": {
      "name": {
        "to": "Atendente1 985038350",
        "from": null
      },
      "role": {
        "to": "agent",
        "from": null
      },
      "email": {
        "to": "atendente1.985038350@verify.test",
        "from": null
      },
      "nickname": {
        "to": "Atendente1 985038350",
        "from": null
      },
      "sector_id": {
        "to": 1,
        "from": null
      }
    }
  },
  {
    "action": "user_updated",
    "changes": {
      "nickname": {
        "to": "Atendente Revisão 1793897986669",
        "from": "Atendente1 985038350"
      }
    }
  },
  {
    "action": "user_updated",
    "changes": {
      "nickname": {
        "to": "Novo Apelido 1793897986669",
        "from": "Atendente Revisão 1793897986669"
      }
    }
  }
]
```

## Jornada transfer: PASSOU

Commit `d974df6ae5d5b4fce362b93ed23560e0abbaa762`, início 2026-11-05T17:00:17.109Z, duração 10 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1124 ms)
2. ok: Atendente assume o chamado (357 ms)
3. ok: Colega acompanha, sem poder responder nem transferir (292 ms): `01-colega-antes.png`
4. ok: Responsável transfere para o colega e perde a resposta (911 ms): `02-escolher-destino.png`, `03-depois-de-transferir.png`
5. ok: Novo responsável passa a responder, sem recarregar (318 ms): `04-novo-responsavel-responde.png`
6. ok: Pela API, o responsável anterior é recusado (16 ms)
7. ok: Supervisor transfere o chamado de outra pessoa (956 ms): `05-supervisor-transferiu.png`
8. ok: Estado final da transferência no banco, com o histórico preservado (247 ms)
9. ok: Responsável assume um segundo chamado para mandar a outro setor (400 ms)
10. ok: Transferência para outro setor exige o formulário e encerra a origem (1683 ms): `06-formulario-outro-setor.png`, `07-origem-realizados.png`
11. ok: Destino recebe na fila, com a origem e a conversa anterior (694 ms): `08-destino-na-fila.png`, `09-destino-responde.png`
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
  "assignee": "Atendente1 017109023",
  "messages": 2
}
```

Auditoria da transferência:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 017109023",
    "changes": {
      "status": {
        "to": "in_progress",
        "from": "queued"
      },
      "assignee_id": {
        "to": 13,
        "from": null
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Atendente1 017109023",
    "changes": {
      "assignee_id": {
        "to": 14,
        "from": 13
      }
    }
  },
  {
    "action": "ticket_transferred_user",
    "actor": "Supervisor 017109023",
    "changes": {
      "assignee_id": {
        "to": 13,
        "from": 14
      }
    }
  }
]
```

Origem e destino:

```json
[
  {
    "sector": "Setor 017109023",
    "status": "closed",
    "closure_type": "transferred",
    "previous_ticket_id": null,
    "subject": "Folha de março"
  },
  {
    "sector": "Setor 017110675",
    "status": "in_progress",
    "closure_type": null,
    "previous_ticket_id": 7,
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
