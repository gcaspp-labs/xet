# Verificação run-20261116-180751

Commit: 66bd14e87adefa3216ec9b5af5481b91b1522c4b. Worktree: clean. Level: journeys. Jornada provisória `quote-send-202` (só para esta PR) e `reply`: 2 de 2 passaram.

- Commit: `66bd14e87adefa3216ec9b5af5481b91b1522c4b` (branch `ticket/202-citacoes-responder`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-16 18:07:53 -0300
- Resumo gerado em: 2026-11-16 18:15:50 -0300
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
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | PASSOU | 14 | `evidence/reply/` |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| quote-send-202 (fora do mapa) | PASSOU | 7 | `evidence/quote-send-202/` |

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
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 1, sendo 1 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261116-180751/logs/backend.log`

## Detalhe de cada jornada

## Jornada quote-send-202: PASSOU

Commit `66bd14e87adefa3216ec9b5af5481b91b1522c4b`, início 2026-11-16T21:14:16.326Z, duração 39 s.

#### Passos

1. ok: Preparar setor, um chamado na fila e uma figurinha do cliente (479 ms)
2. ok: Atendente abre o chamado da fila e assume pela tela (505 ms)
3. ok: A API devolve as mensagens do cliente com seus ids (19 ms)
4. ok: Responsável responde citando a pergunta; a resposta aparece na conversa (322 ms): `01-resposta-citando-na-conversa.png`
5. ok: Citar a figurinha é recusado, sem gravar nada (14 ms)
6. ok: O supervisor não cita: só o responsável responde (772 ms): `02-supervisor-acompanha.png`
7. ok: Estado final no banco (98 ms)

#### Estado final observado

Resposta na API:

```json
{
  "body": "*Atendente1 656327409:*\nAté sexta-feira",
  "quote": {
    "messageId": 1,
    "type": "text",
    "text": "Qual o prazo da guia?"
  }
}
```

Recusa:

```json
{
  "error": "Não é possível responder citando esta mensagem."
}
```

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "type": "text",
    "body": "Qual o prazo da guia?",
    "status": null,
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "direction": "inbound",
    "type": "unsupported",
    "body": null,
    "status": null,
    "quoted_external_message_id": null,
    "quoted_message_id": null,
    "quoted_type": null,
    "quoted_body": null
  },
  {
    "direction": "outbound",
    "type": "text",
    "body": "*Atendente1 656327409:*\nAté sexta-feira",
    "status": "sent",
    "quoted_external_message_id": "VERIFY-656329953",
    "quoted_message_id": 1,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da guia?"
  }
]
```

## Jornada reply: PASSOU

Commit `66bd14e87adefa3216ec9b5af5481b91b1522c4b`, início 2026-11-16T21:14:55.152Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (430 ms)
2. ok: Sem assumir, não há como responder (453 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (158 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (257 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (242 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (647 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (70 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (185 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (254 ms)
10. ok: Pela API, quem não é responsável também é recusado (258 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (381 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (260 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (263 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (111 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 5,
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
    "body": "*Atendente1 695152219:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 695152219:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 695152219:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 695152219:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
