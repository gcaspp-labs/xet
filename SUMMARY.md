# Verificação run-20261104-231438

- Commit: `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f` (branch `task/49-paineis-por-janelas-centrais`)
- Arquivos sem commit na subida: 0
- Início: 2026-11-04 23:14:41 -0300
- Resumo gerado em: 2026-11-04 23:16:43 -0300
- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real.

## Fluxos do mapa

| Fluxo | Resultado | Passos | Evidência |
| --- | --- | --- | --- |
| close | NÃO PROVADO: não percorrido nesta execução | 0 | |
| connection | NÃO PROVADO: não percorrido nesta execução | 0 | |
| receive-and-assign | NÃO PROVADO: não percorrido nesta execução | 0 | |
| reply | NÃO PROVADO: não percorrido nesta execução | 0 | |
| transfer | NÃO PROVADO: não percorrido nesta execução | 0 | |
| pr71-dialogs (fora do mapa) | FALHOU | 10 | `evidence/pr71-dialogs/` |

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
- Log: `/home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-231438/logs/backend.log`

## Cleanup

- Nenhum processo da execução ficou para trás.
- Nenhum contêiner da execução ficou para trás.
- Portas 25440 28090 28091 25173 livres.
- Evidências preservadas: 13 arquivo(s) em /home/thiagocalazans/code/xet-revisor/.verify-app/runs/run-20261104-231438/evidence.

## Detalhe de cada jornada

## Jornada pr71-dialogs: FALHOU

Commit `af007f8b9aa7bcf99c74fd593cacb4a1ac01d56f`, início 2026-11-05T02:16:07.435Z, duração 12 s.

#### Passos

1. ok: Preparar setor, módulo, órgão e contato fictícios (691 ms)
2. ok: Assumir chamado pela tela (457 ms)
3. ok: Encerrar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (3287 ms): `01-encerrar-chamado.png`
4. ok: Transferir para outro setor: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (728 ms): `02-transferir-para-outro-setor.png`
5. ok: Cancelar chamado: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (641 ms): `03-cancelar-chamado.png`
6. ok: Devolver à fila: sem X; Esc e clique fora preservam; Cancelar/Voltar fecha (535 ms): `04-devolver-à-fila.png`
7. ok: Transferir preserva a escolha do seletor (886 ms): `05-transferir-chamado.png`
8. ok: Cadastro pelo atendimento tem bloqueio e preserva nome (526 ms): `06-cadastrar-contato.png`
9. ok: Cadastro aninhado: Cancelar devolve assunto e resolução; Esc não fecha a origem (769 ms): `07-cadastro-aninhado-bloqueado.png`
10. FALHOU: Combobox seleciona órgão e Esc fecha só a lista (47 ms)

#### Falha

```text
locator.click: Error: strict mode violation: getByRole('button', { name: 'Encerrar', exact: true }) resolved to 2 elements:
    1) <button tabindex="0" type="button" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[calc(13px*var(--…>…</button> aka locator('#root').getByRole('button', { name: 'Encerrar' })
    2) <button tabindex="0" type="submit" form="_r_35_" data-slot="button" class="group/button inline-flex shrink-0 cursor-pointer items-center justify-center border font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[15px] border-primary bg-primary text-primary-foreground hover:border-accent-strong hover:bg-accent-strong gap-[7px] rounded-(--radius-8) px-3.5 py-2 text-[ca…>Encerrar</button> aka locator('[id="_r_36_"]').getByRole('button', { name: 'Encerrar' })

Call log:
  - waiting for getByRole('button', { name: 'Encerrar', exact: true })

    at /tmp/xet-revisor-pr71-dialogs.mjs:90:30
    at Journey.step (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:83:27)
    at /tmp/xet-revisor-pr71-dialogs.mjs:89:11
    at async journey (/home/thiagocalazans/code/xet-revisor/.claude/skills/verify-app/scripts/journey-lib.mjs:361:5)
    at async file:///tmp/xet-revisor-pr71-dialogs.mjs:2:1
```

Máquina no momento da falha. Num tempo esgotado, confira isto antes de atribuir ao código:

```text
               total       usada       livre    compart.  buff/cache  disponível
Mem.:          15422        9458        2396        1667        5568        5963
Swap:           2047        2047           0

procs -----------memory---------- ---swap-- -----io---- -system-- -------cpu-------
 r  b   swpd  livre   buff  cache   si   so    bi    bo   in   cs us sy id wa st gu
 2  0 2096820 2454164  79560 5622712   28  108   598   884 7021    5  9  2 88  0  0  0
 1  0 2096820 2459236  79560 5622740    0    0     0    12 14220 8405 13  3 84  0  0  0
 2  0 2096820 2469972  79560 5624744    0    0     0     0 13595 8784 12  3 85  0  0  0
```
