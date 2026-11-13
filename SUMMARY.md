# Verificação run-20261113-195713

- Commit: `995ce9e40e053e0a14ad233708ebe0fa446cd3c8` (branch `ticket/153-fila-admin-setores-ativos`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-13 19:57:15 -0300
- Resumo gerado em: 2026-11-13 19:59:00 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| consult-subjects | NÃO PROVADO: não percorrido nesta execução | 0 | |
| conversas-menu | PASSOU | 4 | `evidence/conversas-menu/` |
| receive-and-assign | FALHOU | 2 | `evidence/receive-and-assign/` |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| fila-admin-setores-ativos (fora do mapa) | PASSOU | 10 | `evidence/fila-admin-setores-ativos/` |

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
- Log: `.verify-app/runs/run-20261113-195713/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 18 arquivo(s) em .verify-app/runs/run-20261113-195713/evidence.

## Detalhe de cada jornada

## Jornada conversas-menu: PASSOU

Commit `995ce9e40e053e0a14ad233708ebe0fa446cd3c8`, início 2026-11-13T22:58:04.261Z, duração 3 s.

#### Passos

1. ok: Preparar setor e atendente (419 ms)
2. ok: Abrir Conversas pelo menu (188 ms): `01-conversas-vazia.png`
3. ok: Abrir uma conversa e conferir os temas (1613 ms): `02-fila-com-chamado.png`, `03-conversa-claro.png`, `04-conversa-escuro.png`, `05-conversa-alto-contraste.png`
4. ok: Estado final do setor (121 ms)

#### Estado final observado

Chamados em atendimento no setor:

```json
{
  "quantidade": 1
}
```

## Jornada fila-admin-setores-ativos: PASSOU

Commit `995ce9e40e053e0a14ad233708ebe0fa446cd3c8`, início 2026-11-13T22:57:55.361Z, duração 4 s.

#### Passos

1. ok: Preparar setor ativo e setor que será desativado (456 ms)
2. ok: Setor 2 (408 ms)
3. ok: Atendente do setor assume o chamado próprio antes da desativação (299 ms)
4. ok: Chegam chamados nos dois setores e o setor 2 é desativado (319 ms)
5. ok: Administrador: lista e contador só com o setor ativo (273 ms): `01-admin-fila-so-ativos.png`
6. ok: Chamado novo no setor inativo não entra; no ativo entra, em tempo real (163 ms): `02-admin-fila-tempo-real.png`
7. ok: Contador sobre a aba Fila com a aba Assuntos aberta (341 ms): `03-admin-contador-aba-assuntos.png`
8. ok: Contador some quando a fila visível esvazia (513 ms): `04-admin-fila-vazia-com-setor-inativo-pendente.png`
9. ok: Atendente do setor inativo mantém fila e Meus atendimentos (167 ms): `05-atendente-setor-inativo.png`
10. ok: Estado final no banco (122 ms)

#### Estado final observado

Setor desativado:

```json
[
  {
    "id": 1,
    "active": true
  },
  {
    "id": 2,
    "active": false
  }
]
```

Chamados por situação:

```json
[
  {
    "active": false,
    "status": "queued",
    "n": 2
  },
  {
    "active": false,
    "status": "in_progress",
    "n": 1
  },
  {
    "active": true,
    "status": "in_progress",
    "n": 3
  }
]
```

## Jornada receive-and-assign: FALHOU

Commit `995ce9e40e053e0a14ad233708ebe0fa446cd3c8`, início 2026-11-13T22:58:07.738Z, duração 24 s.

#### Passos

1. ok: Preparar setor conectado, dois atendentes e um supervisor (576 ms)
2. FALHOU: Atendente entra e vê a fila vazia (20025 ms)

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
Mem.:          15422        8053        3698         898        5197        7368
Swap:           2047        1568         479

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 0  0 1606448 3787544 138364 5184304    8   36  1248  1172 5641    5  7  2 90  1  0  0
 0  0 1606448 3793332 138364 5184252    0    0     0    56 5071 5846  2  1 97  0  0  0
 2  0 1606448 3788352 138376 5184288    0    0     0   236 6698 8997  4  1 95  0  0  0
```
