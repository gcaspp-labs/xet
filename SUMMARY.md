# Verificação run-20261111-123140

Commit: 015dc59c85aa9624ad64ca51306730ec442cae8a. Worktree: clean. Level: journeys.

- Commit: `015dc59c85aa9624ad64ca51306730ec442cae8a` (branch `ticket/126-contatos-paginacao-e-ordenacao`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-11 12:31:42 -0300
- Resumo gerado em: 2026-11-11 12:32:59 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| contacts-address-fixes (fora do mapa) | PASSOU | 5 | `evidence/contacts-address-fixes/` |
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
- Log: `.verify-app/runs/run-20261111-123140/logs/backend.log`

## Detalhe de cada jornada

## Jornada contacts-address-fixes: PASSOU

Commit `015dc59c85aa9624ad64ca51306730ec442cae8a`, início 2026-11-11T15:32:50.391Z, duração 3 s.

#### Passos

1. ok: Preparar setor com dois órgãos de Itu e um contato em cada (pela API) (528 ms)
2. ok: Reabrir endereço com órgão e busca sem resultado mostra o órgão no campo (290 ms): `01-orgao-lista-vazia.png`
3. ok: Reabrir com órgão e escolher o município dele mantém o órgão (545 ms): `02-municipio-mantem-orgao.png`
4. ok: Coluna desconhecida no endereço volta a nome crescente (246 ms): `03-coluna-desconhecida.png`
5. ok: Estado final pela API e no banco (134 ms)

#### Estado final observado

Contatos do órgão no banco:

```json
[
  {
    "name": "Hugo S1"
  }
]
```

## Jornada contacts-paging: PASSOU

Commit `015dc59c85aa9624ad64ca51306730ec442cae8a`, início 2026-11-11T15:32:53.359Z, duração 3 s.

#### Passos

1. ok: Preparar setor com 23 contatos em dois órgãos (pela API) (918 ms)
2. ok: Atendente abre Contatos: página 1 de 2, por nome (344 ms): `01-pagina-1.png`
3. ok: Próxima: página 2 no endereço, com os 3 restantes (203 ms): `02-pagina-2.png`
4. ok: Contato decrescente volta à página 1 (157 ms): `03-contato-desc.png`
5. ok: Ordem por órgão: Autarquia antes da Câmara (208 ms): `04-orgao-asc.png`
6. ok: Ir a Órgãos e voltar mantém página e ordem (356 ms): `05-voltar.png`
7. ok: Página além da última mostra a última e corrige o endereço (293 ms): `06-pagina-excedente.png`
8. ok: Estado final pela API: total 23, página 2 com 3 itens (18 ms)

#### Estado final observado

API: total 23, página 2, 3 itens:

```json

```
