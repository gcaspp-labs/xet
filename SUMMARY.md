# Verificação run-20261119-193231

- Commit: `70c54fbd7fe9a0501eb0bbf7066f237e5f431160` (branch `ticket/291-alteracoes-externas-historico`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-19 19:32:33 -0300
- Resumo gerado em: 2026-11-19 19:34:53 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-closed-tickets | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| final-routes | NÃO PROVADO: não percorrido nesta execução | 0 | |
| message-revisions | PASSOU | 7 | `evidence/message-revisions/` |
| receive-and-assign | PASSOU | 12 | `evidence/receive-and-assign/` |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |

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
- message-revisions: [não coberto] Edição de legenda, edição e exclusão pelo celular do setor, evento antes da original, chamado encerrado e isolamento por setor (testes de integração em `backend/internal/helpdesk/message_changes_test.go`).
- message-revisions: [manual] Edição e exclusão feitas num celular real chegando pelo Whatsmeow.
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
- transfer: [não coberto] Contato com órgão principal: o chamado chega ao destino com esse órgão (regra 14; `TestSectorTransferTakesTheMainOrganizationOfTheContact`).
- transfer: [não coberto] Transferência sem motivo e quadro de origem de uma transferência antiga, com assunto e resolução (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (`transfer-sector.spec.ts` e testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 3, sendo 3 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261119-193231/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 24 arquivo(s) em .verify-app/runs/run-20261119-193231/evidence.

## Detalhe de cada jornada

## Jornada message-revisions: PASSOU

Commit `70c54fbd7fe9a0501eb0bbf7066f237e5f431160`, início 2026-11-19T22:34:14.334Z, duração 3 s.

#### Passos

1. ok: Preparar setor conectado com um atendente (427 ms)
2. ok: Mensagem do cliente chega à fila (38 ms)
3. ok: Atendente assume e vê a mensagem original (389 ms): `01-mensagem-original.png`
4. ok: Cliente edita no WhatsApp: a conversa mostra a versão nova sem recarregar (174 ms): `02-mensagem-editada.png`
5. ok: Reentrega e edição atrasada não mudam a versão atual (301 ms)
6. ok: Cliente apaga para todos: o conteúdo conhecido continua na conversa (270 ms): `03-mensagem-apagada-pelo-cliente.png`
7. ok: Estado final no banco (353 ms)

#### Estado final observado

Mensagem:

```json
{
  "id": 1,
  "body": "Preciso do balancete de outubro",
  "edited": true,
  "deletion_scope": "everyone",
  "deletion_origin": "customer"
}
```

Versões e exclusão (message_changes):

```json
[
  {
    "kind": "edit",
    "origin": "customer",
    "body": "versão antiga atrasada"
  },
  {
    "kind": "original",
    "origin": "customer",
    "body": "Preciso do balancete de setembro"
  },
  {
    "kind": "edit",
    "origin": "customer",
    "body": "Preciso do balancete de outubro"
  },
  {
    "kind": "deletion",
    "origin": "customer",
    "body": null
  }
]
```

Chamados do setor:

```json
[
  {
    "status": "in_progress"
  }
]
```

## Jornada receive-and-assign: PASSOU

Commit `70c54fbd7fe9a0501eb0bbf7066f237e5f431160`, início 2026-11-19T22:34:17.551Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (622 ms)
2. ok: Atendente entra na tela Chamados e vê a fila vazia (122 ms): `01-fila-vazia.png`
3. ok: Mensagem de número desconhecido entra na fila sem recarregar (176 ms): `02-mensagem-na-fila.png`
4. ok: Reentrega da mesma mensagem não gera efeito (138 ms)
5. ok: Segunda mensagem entra no mesmo chamado, sem abrir outro (234 ms): `03-mesmo-chamado.png`
6. ok: Atendente assume pela fila e cai no chamado (264 ms): `04-conversa-assumida.png`
7. ok: Colega com a tela desatualizada perde a disputa e é avisada (137 ms): `05-disputa-perdida.png`
8. ok: Duas pessoas assumindo ao mesmo tempo: só uma consegue (296 ms)
9. ok: Em Meus chamados o chamado está com o responsável, fora da fila (194 ms): `06-meus-chamados.png`
10. ok: Atendente assume outro chamado pela fila, sem chamado aberto (272 ms): `07-assumido-pela-fila.png`
11. ok: Outro setor não vê a fila nem abre o chamado (1031 ms): `08-outro-setor-nao-ve.png`
12. ok: Estado final no banco (590 ms)

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
  "protocol": "2026-000002",
  "status": "in_progress",
  "assignee": "Atendente1 657552301",
  "has_assigned_at": true
}
```

Auditoria do chamado:

```json
[
  {
    "action": "ticket_assigned",
    "actor": "Atendente1 657552301"
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

Commit `70c54fbd7fe9a0501eb0bbf7066f237e5f431160`, início 2026-11-19T22:34:23.400Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (406 ms)
2. ok: Sem assumir, não há como responder (372 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (184 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (283 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (281 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (680 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (86 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (197 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (239 ms)
10. ok: Pela API, quem não é responsável também é recusado (277 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (454 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (321 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (293 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (112 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 7,
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
    "body": "*Atendente1 663400889:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 663400889:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 663400889:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 663400889:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
