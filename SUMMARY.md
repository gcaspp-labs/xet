# Verificação run-20261104-234238

- Commit: `b6f41b290963c4b86ce4afb9f97c24f377876af1` (branch `task/49-paineis-por-janelas-centrais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 23:42:40 -0300
- Resumo gerado em: 2026-11-04 23:44:25 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pr71-action-overlap (fora do mapa) | FALHOU | 5 | `evidence/pr71-action-overlap/` |
| pr71-recheck-verified (fora do mapa) | PASSOU | 7 | `evidence/pr71-recheck-verified/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 12 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/evidence.

## Detalhe de cada jornada

## Jornada pr71-action-overlap: FALHOU

Commit `b6f41b290963c4b86ce4afb9f97c24f377876af1`, início 2026-11-05T02:43:52.855Z, duração 11 s.

#### Passos

1. ok: Preparar dois chamados fictícios no mesmo setor (642 ms)
2. ok: Abrir e assumir o primeiro chamado (440 ms)
3. ok: Assumir o segundo pelo sino e abrir Encerrar no primeiro (800 ms): `01-link-sobre-botao-encerrar.png`
4. ok: Com o cursor sobre o link, observar se o bloqueio persiste por 5 segundos (5154 ms): `02-link-persistente-apos-cinco-segundos.png`
5. FALHOU: Clique no trecho coberto do Encerrar deve continuar no mesmo chamado (1067 ms)

#### Falha

```text
Error: expect(page).toHaveURL(expected) failed

Expected pattern: /\/chamados\/3$/
Received string:  "http://127.0.0.1:25173/chamados/4"
Timeout: 1000ms

Call log:
  - Expect "toHaveURL" with timeout 1000ms
    11 × locator resolved to <html lang="pt-BR">…</html>
       - unexpected value "http://127.0.0.1:25173/chamados/4"

    at captureRawStack (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright-core/lib/coreBundle.js:9282:17)
    at callMatcherAsStep (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13316:57)
    at Object.toHaveURL (/home/thiagocalazans/code/xet-revisor/frontend/node_modules/playwright/lib/matchers/expect.js:13308:23)
    at /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:50:23
    at async Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:21)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:48:2
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-234238/pr71-action-overlap.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9376        2608        1639        5410        6045
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 4  0 2096452 2671272  80352 5460260   26  101   587   890 7465    6 10  2 87  0  0  0
 2  0 2096452 2671884  80352 5459848    0    0     0    72 11531 10396 14  3 83  0  0  0
 1  0 2096452 2678560  80352 5459800    0    0     0     0 11738 10039 12  4 83  0  0  0
```

#### Estado final observado

Link e botão ocupam o mesmo ponto:

```json
{
  "x": 784,
  "y": 510.3168487548828
}
```

## Jornada pr71-recheck-verified: PASSOU

Commit `b6f41b290963c4b86ce4afb9f97c24f377876af1`, início 2026-11-05T02:43:01.317Z, duração 8 s.

#### Passos

1. ok: Preparar setor e contato fictícios (690 ms)
2. ok: Assumir e abrir encerramento com bloqueio (586 ms)
3. ok: Esc preserva o assunto, e Cancelar no cadastro volta à janela de origem (412 ms)
4. ok: Completar registro e salvar contato pela janela aninhada (1184 ms)
5. ok: Aviso visível sobre Encerrar deixa o clique passar, sem força ou espera (2998 ms): `01-contato-salvo-sobre-encerrar.png`, `02-encerrado-sem-bloqueio.png`
6. ok: Assumir pelo sino mantém Abrir conversa clicável (1114 ms): `03-link-abrir-conversa-funciona.png`
7. ok: Estado final confirmado no banco (270 ms)

#### Estado final observado

Clique sob o aviso:

```json
{
  "forcado": false,
  "esperaAntesDoClique": false,
  "intersecaoComBotao": {
    "x": 25.5,
    "y": 21.681167602539062
  }
}
```

Chamado encerrado:

```json
{
  "status": "closed",
  "closure_type": "resolved",
  "subject": "Contracheque de teste",
  "resolution": "Segunda via enviada no teste fictício."
}
```

Chamado aberto pelo link:

```json
{
  "status": "in_progress",
  "assignee_id": 3
}
```
