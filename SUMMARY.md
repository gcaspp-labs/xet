# Verificação run-20261114-155042

- Commit: `fa18fb421eb95b887a53658ed2cedb9dd540f060` (branch `ticket/177-ficha-so-leitura`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-14 15:50:44 -0300
- Resumo gerado em: 2026-11-14 15:54:01 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | FALHOU | 1 | `evidence/close/` |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | FALHOU | 2 | `evidence/transfer/` |
| ficha-177 (fora do mapa) | PASSOU | 10 | `evidence/ficha-177/` |
| ficha-177-cadeia (fora do mapa) | PASSOU | 5 | `evidence/ficha-177-cadeia/` |

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
- conversas-menu: [não coberto] Filtrar e ordenar atendimentos, trocar de chamado e acessar Assuntos (`conversas.spec.ts`).
- conversas-menu: [manual] Receber e responder pelo WhatsApp real.
- receive-and-assign: [não coberto] Assumir pela lista da tela do chamado, sem mudar de tela (`conversation.spec.ts`).
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
- transfer: [não coberto] Abrir o chamado anterior pelo destino, sem poder agir nela (`transfer-sector.spec.ts`).
- transfer: [não coberto] Recusa da transferência para um setor onde o contato já tem chamado aberto (só testes de integração).
- transfer: [manual] Primeira mensagem do destino chegando ao celular do contato pelo número do destino. Exige um segundo número de teste.

## Sinais do backend

- Linhas de erro no log do backend: 0, sendo 0 de requisição cancelada pelo cliente.
- Log: `.verify-app/runs/run-20261114-155042/logs/backend.log`

## Detalhe de cada jornada

## Jornada close: FALHOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:52:39.214Z, duração 23 s.

#### Passos

1. ok: Preparar setor conectado com módulos, um órgão e um chamado de número desconhecido (468 ms)

#### Falha

```text
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Realizados hoje' })
Expected substring: "Nenhum atendimento realizado hoje."
Timeout: 20000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Realizados hoje' }) with timeout 20000ms
  - waiting for getByRole('region', { name: 'Realizados hoje' })

    at captureRawStack (frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toContainText (frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at scripts/verify/journeys/close.mjs:20:32
    at async journey (scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file://scripts/verify/journeys/close.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9665        3352         863        3652        5756
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 2097060 3433384  68280 3671804    6   25   793   851 5079    4  6  1 91  1  0  0
 0  0 2097060 3432716  68300 3672664    0    0   436   304 1325 1956  1  0 99  0  0  0
 0  0 2097060 3438184  68300 3672280    0    0     0    56 2298 3593  1  1 98  0  0  0
```

## Jornada ficha-177: PASSOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:52:29.114Z, duração 6 s.

#### Passos

1. ok: Preparar setor com dois atendentes, módulo, órgão, contato cadastrado e duas conversas (842 ms)
2. ok: Atendente assume e encerra o chamado de Rita pela tela Chamados (848 ms): `01-encerrado-volta-aos-chamados.png`
3. ok: Atendente cancela o chamado de Paula (435 ms)
4. ok: Pelo menu Atendimentos, a linha de Rita abre a ficha só leitura (414 ms): `02-ficha-encerrado-com-corrigir.png`
5. ok: Corrigir abre na própria ficha e a correção entra na conversa (636 ms): `03-correcao-aberta.png`, `04-ficha-depois-da-correcao.png`
6. ok: Aba Histórico lista os chamados do contato com link para /atendimentos/:id (170 ms): `05-ficha-historico.png`
7. ok: Chamado cancelado: ficha só leitura, sem Corrigir nem para o atendente que cancelou (306 ms): `06-ficha-cancelado.png`
8. ok: Outro atendente lê a ficha de Rita, sem Corrigir (751 ms): `07-ficha-outro-atendente-sem-corrigir.png`
9. ok: Supervisor do setor vê o Corrigir (778 ms): `08-ficha-supervisor-com-corrigir.png`
10. ok: Estado final no banco (341 ms)

#### Estado final observado

Chamados:

```json
[
  {
    "id": 5,
    "status": "closed",
    "closure_type": "resolved",
    "resolution": "Segunda via enviada por e-mail."
  },
  {
    "id": 6,
    "status": "closed",
    "closure_type": "cancelled",
    "resolution": null
  }
]
```

Auditoria:

```json
[
  {
    "ticket_id": 5,
    "action": "ticket_closed",
    "reason": null
  },
  {
    "ticket_id": 6,
    "action": "ticket_cancelled",
    "reason": "Golpe do falso boleto."
  },
  {
    "ticket_id": 5,
    "action": "ticket_corrected",
    "reason": "Resolução incompleta."
  }
]
```

## Jornada ficha-177-cadeia: PASSOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:53:46.498Z, duração 5 s.

#### Passos

1. ok: Preparar origem e destino, contato cadastrado e conversa na origem (967 ms)
2. ok: Origem assume e transfere para outro setor pela tela Chamados (1196 ms)
3. ok: Ficha da origem mostra a cadeia com o destino e o rodapé Transferido (260 ms): `01-ficha-origem-cadeia.png`
4. ok: Destino cancela o chamado novo e a ficha dele liga à origem (1277 ms): `02-ficha-destino-cadeia.png`, `03-ficha-origem-vista-do-destino.png`
5. ok: Estado final no banco (241 ms)

#### Estado final observado

Chamados:

```json
[
  {
    "id": 10,
    "sector_id": 7,
    "status": "closed",
    "closure_type": "transferred"
  },
  {
    "id": 11,
    "sector_id": 8,
    "status": "closed",
    "closure_type": "cancelled"
  }
]
```

## Jornada transfer: FALHOU

Commit `fa18fb421eb95b887a53658ed2cedb9dd540f060`, início 2026-11-14T18:53:03.019Z, duração 24 s.

#### Passos

1. ok: Preparar dois setores conectados, pessoas, módulo, órgão e dois chamados na fila (1040 ms)
2. FALHOU: Atendente assume o chamado (20021 ms)

#### Falha

```text
locator.click: Timeout 20000ms exceeded.
Call log:
  - waiting for getByRole('link', { name: 'Joana Cliente' })

    at scripts/verify/journeys/transfer.mjs:24:61
    at Journey.step (scripts/verify/scripts/journey-lib.mjs:83:27)
    at scripts/verify/journeys/transfer.mjs:23:28
    at async journey (scripts/verify/scripts/journey-lib.mjs:361:5)
    at async file://scripts/verify/journeys/transfer.mjs:4:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9639        3377         861        3651        5782
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 1  0 2097060 3458604  68620 3670740    6   25   793   851 5079    4  6  1 91  1  0  0
 0  0 2097060 3457640  68632 3670644    0    0     0   160 1063 1611  0  0 99  0  0  0
 0  0 2097060 3458300  68632 3670644    0    0     0     0 1127 1816  1  0 99  0  0  0
```
