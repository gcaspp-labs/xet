# Verificação run-20261113-191657

- Commit: `0e40068d3fa857f5f5ed1f20a14739cecfff8315` (branch `ticket/155-sino-abrir-conversa-assumida`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-13 19:16:59 -0300
- Resumo gerado em: 2026-11-13 19:19:51 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | FALHOU | 2 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| sino-abrir-conversa (fora do mapa) | PASSOU | 5 | `evidence/sino-abrir-conversa/` |

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
- conversas-menu: [não coberto] Filtrar e ordenar atendimentos, trocar de conversa e acessar Assuntos (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
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
- Log: `.verify-app/runs/run-20261113-191657/logs/backend.log`

## Detalhe de cada jornada

## Jornada receive-and-assign: FALHOU

Commit `0e40068d3fa857f5f5ed1f20a14739cecfff8315`, início 2026-11-13T22:19:27.914Z, duração 24 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (611 ms)
2. FALHOU: Atendente entra e vê a fila vazia (20023 ms)

#### Falha

```text
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: 'Atendimento' })
Expected: visible
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: 'Atendimento' }) with timeout 20000ms
  - waiting for getByRole('heading', { name: 'Atendimento' })

    at captureRawStack (frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toBeVisible (frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at scripts/verify/journeys/receive-and-assign.mjs:17:75
    at Journey.step (scripts/verify/scripts/journey-lib.mjs:83:27)
    at scripts/verify/journeys/receive-and-assign.mjs:16:11
    at async journey (scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file://scripts/verify/journeys/receive-and-assign.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        8170        3840         908        4947        7252
Swap:           2047        1534         513

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 1570892 3933164 108520 4958196    8   36  1274  1191 5631    5  7  2 90  1  0  0
 0  0 1570892 3934848 108520 4958136    0    0     0    12 4827 5844  1  1 98  0  0  0
 0  0 1570892 3934944 108532 4958296    0    0     0   248 6081 7769  2  1 97  0  0  0
```

## Jornada sino-abrir-conversa: PASSOU

Commit `0e40068d3fa857f5f5ed1f20a14739cecfff8315`, início 2026-11-13T22:19:21.146Z, duração 2 s.

#### Passos

1. ok: Preparar setor com um atendente (414 ms)
2. ok: Chamado chega e aparece no sino (306 ms): `01-sino-com-pendente.png`
3. ok: Assumir pelo sino não troca de tela e mostra o aviso com o link (442 ms): `02-aviso-chamado-assumido.png`
4. ok: Abrir conversa leva à tela Conversas com o chamado certo (282 ms): `03-tela-conversas.png`
5. ok: Estado final no banco (111 ms)

#### Estado final observado

Chamado da Carla:

```json
[
  {
    "id": 4,
    "status": "in_progress",
    "assumido": true
  }
]
```
