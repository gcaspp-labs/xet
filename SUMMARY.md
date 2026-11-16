# Verificação run-20261116-194841

- Commit: `d1711bab9c118dd9672c4f1d6bd2ce8528e870ce` (branch `ticket/203-citacoes-na-conversa`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-16 19:48:43 -0300
- Resumo gerado em: 2026-11-16 19:50:35 -0300
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
| quotes-203 (fora do mapa) | PASSOU | 7 | `evidence/quotes-203/` |

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

- Linhas de erro no log do backend: 3, sendo 3 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261116-194841/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 18 arquivo(s) em .verify-app/runs/run-20261116-194841/evidence.

## Detalhe de cada jornada

## Jornada quotes-203: PASSOU

Commit `d1711bab9c118dd9672c4f1d6bd2ce8528e870ce`, início 2026-11-16T22:50:08.821Z, duração 4 s.

#### Passos

1. ok: Preparar setor, atendente e um cliente que cita mensagens (502 ms)
2. ok: Abrir o chamado da fila e assumir (471 ms)
3. ok: Citações recebidas: conhecida, trecho do WhatsApp e indisponível (112 ms): `01-citacoes-recebidas.png`
4. ok: Botão de responder ao lado do balão e citação em preparo (321 ms): `02-botao-responder.png`, `03-em-preparo.png`
5. ok: Cancelar a citação e voltar a citar; enviar mostra a citação no balão (446 ms): `04-enviada-com-citacao.png`
6. ok: Recarregar mantém a citação; chamado de outra pessoa não tem o botão (1057 ms): `05-sem-permissao.png`
7. ok: Estado final no banco (107 ms)

#### Estado final observado

Mensagens do chamado:

```json
[
  {
    "direction": "inbound",
    "body": "Qual o prazo da nota?",
    "linked": false,
    "quoted_type": null,
    "quoted_body": null,
    "has_quote": false
  },
  {
    "direction": "inbound",
    "body": "Isso mesmo",
    "linked": true,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da nota?",
    "has_quote": true
  },
  {
    "direction": "inbound",
    "body": "E este?",
    "linked": false,
    "quoted_type": "document",
    "quoted_body": "contrato.pdf",
    "has_quote": true
  },
  {
    "direction": "inbound",
    "body": "Oi?",
    "linked": false,
    "quoted_type": null,
    "quoted_body": null,
    "has_quote": true
  },
  {
    "direction": "outbound",
    "body": "*Atendente1 408822172:*\nO prazo é sexta-feira",
    "linked": true,
    "quoted_type": "text",
    "quoted_body": "Qual o prazo da nota?",
    "has_quote": true
  }
]
```

## Jornada reply: PASSOU

Commit `d1711bab9c118dd9672c4f1d6bd2ce8528e870ce`, início 2026-11-16T22:50:02.869Z, duração 6 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (454 ms)
2. ok: Sem assumir, não há como responder (374 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (218 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (244 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (232 ms): `03-mensagem-enviada.png`
6. ok: Seletor de emojis: busca, insere no cursor e a mensagem sai com o emoji (741 ms): `04-seletor-aberto.png`, `05-emoji-inserido.png`
7. ok: Supervisor vê a resposta na outra janela, sem recarregar (96 ms): `06-supervisor-acompanha.png`
8. ok: Celular do contato confirma a entrega e a leitura (199 ms): `07-mensagem-lida.png`
9. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (263 ms)
10. ok: Pela API, quem não é responsável também é recusado (249 ms)
11. ok: Arquivo com legenda é enviado e fica disponível na conversa (376 ms): `08-arquivo-enviado.png`
12. ok: Número caído: a mensagem falha, sem reenvio automático (326 ms): `09-mensagem-falhou.png`
13. ok: Com o número de volta, o responsável reenvia sem duplicar (332 ms): `10-mensagem-reenviada.png`
14. ok: Estado final no banco (116 ms)

#### Estado final observado

Envio repetido:

```json
{
  "http": 200,
  "mesmaMensagem": 2,
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
    "body": "*Atendente1 402869445:*\nSegue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 402869445:*\nObrigada❤️",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "*Atendente1 402869445:*\nContracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "*Atendente1 402869445:*\nMensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
