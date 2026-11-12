# Verificação run-20261111-210559

Commit: ee00a7cfc14d751ee50c07933c80ace785a909da. Branch: `ticket/135-consultar-assuntos-e-solucoes`.
- Arquivos sem commit na subida: 0
- Início: 2026-11-11 21:06:01 -0300
- Resumo gerado em: 2026-11-11 21:06:46 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Comparação com o protótipo aprovado

A aba segue a versão C: coluna de 420 px, busca e soluções em cartões com etiqueta e botão Copiar. A captura usa 1280 px e mostra o chat mais estreito que a referência de 1440 px; a conversa continuou utilizável. O aviso de contato não cadastrado decorre dos dados fictícios da jornada.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | PASSOU | 6 | `evidence/consult-subjects/` |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | PASSOU | 13 | `evidence/reply/` |
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
- consult-subjects: [não coberto] Permissão, setor vazio, ausência de resultados e tela estreita (`subjects.spec.ts`).
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
- Log: `.verify-app/runs/run-20261111-210559/logs/backend.log`

## Detalhe de cada jornada

## Jornada consult-subjects: PASSOU

Commit `ee00a7cfc14d751ee50c07933c80ace785a909da`, início 2026-11-12T00:06:36.115Z, duração 3 s.

#### Passos

1. ok: Preparar setor, assuntos e dois chamados (545 ms)
2. ok: Assumir chamado e consultar soluções ao lado do chat (679 ms): `01-assuntos-e-chat.png`
3. ok: Enviar mensagem e buscar sem acentos ou maiúsculas (294 ms): `02-busca-por-solucao.png`
4. ok: Copiar a solução e manter o texto fora do chat (178 ms): `03-solucao-copiada.png`
5. ok: Outro chamado começa em Detalhes e o anterior mantém a busca (338 ms): `04-busca-restaurada.png`
6. ok: Estado final da conversa e da lista (228 ms)

#### Estado final observado

Mensagem enviada e assunto preservado:

```json
{
  "messages": [
    {
      "body": "Atendente1 996115263: Vou conferir as orientações."
    }
  ],
  "assuntos": 1
}
```

## Jornada reply: PASSOU

Commit `ee00a7cfc14d751ee50c07933c80ace785a909da`, início 2026-11-12T00:06:39.552Z, duração 5 s.

#### Passos

1. ok: Preparar setor conectado, atendente, supervisor e um chamado na fila (480 ms)
2. ok: Sem assumir, não há como responder (336 ms): `01-sem-assumir.png`
3. ok: Atendente assume e a caixa de resposta aparece (173 ms)
4. ok: Quem não é o responsável acompanha, mas não responde (264 ms): `02-supervisor-sem-resposta.png`
5. ok: Responsável responde com Enter e a mensagem sai (237 ms): `03-mensagem-enviada.png`
6. ok: Supervisor vê a resposta na outra janela, sem recarregar (94 ms): `04-supervisor-acompanha.png`
7. ok: Celular do contato confirma a entrega e a leitura (195 ms): `05-mensagem-lida.png`
8. ok: Repetir o envio devolve a mesma mensagem, sem duplicar (237 ms)
9. ok: Pela API, quem não é responsável também é recusado (247 ms)
10. ok: Arquivo com legenda é enviado e fica disponível na conversa (335 ms): `06-arquivo-enviado.png`
11. ok: Número caído: a mensagem falha, sem reenvio automático (303 ms): `07-mensagem-falhou.png`
12. ok: Com o número de volta, o responsável reenvia sem duplicar (243 ms): `08-mensagem-reenviada.png`
13. ok: Estado final no banco (107 ms)

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
    "body": "Atendente1 999553904: Segue o contracheque em anexo.",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "document",
    "status": "sent",
    "body": "Atendente1 999553904: Contracheque de outubro",
    "accepted_by_provider": true
  },
  {
    "direction": "outbound",
    "origin": "agent",
    "type": "text",
    "status": "sent",
    "body": "Atendente1 999553904: Mensagem com o número caído",
    "accepted_by_provider": true
  }
]
```
