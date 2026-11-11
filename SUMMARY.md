# Verificação run-20261111-120308

Commit: 55616c52a6b7691f838fa7d8466567eb2ae002d6. Worktree: clean. Level: journeys.

- Commit: `55616c52a6b7691f838fa7d8466567eb2ae002d6` (branch `ticket/126-contatos-paginacao-e-ordenacao`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-11 12:03:10 -0300
- Resumo gerado em: 2026-11-11 12:05:37 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| contacts-paging (fora do mapa) | PASSOU | 8 | `evidence/contacts-paging/` |

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
- Log: `.verify-app/runs/run-20261111-120308/logs/backend.log`

## Detalhe de cada jornada

## Jornada contacts-paging: PASSOU

Commit `55616c52a6b7691f838fa7d8466567eb2ae002d6`, início 2026-11-11T15:05:25.515Z, duração 3 s.

#### Passos

1. ok: Preparar setor com 23 contatos em dois órgãos (pela API) (1020 ms)
2. ok: Atendente abre Contatos: página 1 de 2, por nome (299 ms): `01-pagina-1.png`
3. ok: Próxima: página 2 no endereço, com os 3 restantes (196 ms): `02-pagina-2.png`
4. ok: Contato decrescente volta à página 1 (166 ms): `03-contato-desc.png`
5. ok: Ordem por órgão: Autarquia antes da Câmara (163 ms): `04-orgao-asc.png`
6. ok: Ir a Órgãos e voltar mantém página e ordem (360 ms): `05-voltar.png`
7. ok: Página além da última mostra a última e corrige o endereço (305 ms): `06-pagina-excedente.png`
8. ok: Estado final pela API: total 23, página 2 com 3 itens (12 ms)

#### Estado final observado

API: total 23, página 2, 3 itens:

```json

```
