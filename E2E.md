# Testes ponta a ponta da revisão

Commit: `8d907dd7f8ad1da5ad5ce2a3e9cf1071e96097fb`.

Foram executados os quatro arquivos originais do PR: `dashboard.spec.ts`, `select.spec.ts`, `notifications.spec.ts` e `form-dialogs.spec.ts`, sem alteração nos testes, com 1 worker e sem retries, contra a instância isolada de verify-app em 25173. Não houve uso das portas reservadas de make test. O administrador foi criado com dados fictícios neste banco descartável.

```text

Running 40 tests using 1 worker

  ✓   1 frontend/e2e/dashboard.spec.ts:92:1 › supervisor abre pelo menu, vê só o próprio setor e não tem filtro de setor (2.3s)
  ✓   2 frontend/e2e/dashboard.spec.ts:118:1 › administrador alterna entre todos os setores e um setor; atendente e módulo dependem do setor (3.5s)
  ✓   3 frontend/e2e/dashboard.spec.ts:171:1 › atendente não vê o item e, pelo endereço, volta ao painel (1.4s)
  ✓   4 frontend/e2e/dashboard.spec.ts:182:1 › chamado novo muda "Na fila" e "Recebidos" sem recarregar (1.7s)
  ✓   5 frontend/e2e/dashboard.spec.ts:202:1 › recarrega os números ao reconectar o tempo real (2.9s)
  ✓   6 frontend/e2e/dashboard.spec.ts:229:1 › filtros mudam os números, indicam o que não se aplica e sobrevivem ao recarregar (5.9s)
  ✓   7 frontend/e2e/dashboard.spec.ts:360:1 › cada seção recolhe e abre, por clique e por teclado, sem afetar a outra (2.4s)
  ✓   8 frontend/e2e/dashboard.spec.ts:446:1 › sem acesso ao armazenamento, recolher vale até recarregar (1.7s)
  ✓   9 frontend/e2e/dashboard.spec.ts:478:3 › com o texto "Maior", a página não rola para o lado na largura 375 (1.5s)
  ✓  10 frontend/e2e/dashboard.spec.ts:478:3 › com o texto "Maior", a página não rola para o lado na largura 1280 (1.5s)
  ✓  11 frontend/e2e/form-dialogs.spec.ts:43:1 › as janelas do atendimento têm bloqueio (4.5s)
  ✓  12 frontend/e2e/form-dialogs.spec.ts:95:1 › cancelar o cadastro aberto pelo encerramento volta à janela com os dados mantidos (2.5s)
  ✓  13 frontend/e2e/form-dialogs.spec.ts:123:1 › nova conversa e o cadastro aberto por ela têm bloqueio (1.7s)
  ✓  14 frontend/e2e/form-dialogs.spec.ts:150:1 › contatos, importação e histórico fecham por X, Esc e clique fora (4.1s)
  ✓  15 frontend/e2e/form-dialogs.spec.ts:177:1 › cadastros do administrador fecham por X, Esc e clique fora (5.2s)
  ✓  16 frontend/e2e/form-dialogs.spec.ts:201:1 › módulos e desvincular número fecham por X, Esc e clique fora (3.0s)
  ✓  17 frontend/e2e/form-dialogs.spec.ts:215:1 › seletores funcionam dentro da janela, e o Esc fecha só a lista (3.5s)
  ✓  18 frontend/e2e/form-dialogs.spec.ts:278:1 › em formulário longo, só o corpo rola e o rodapé fica visível (2.0s)
  ✓  19 frontend/e2e/form-dialogs.spec.ts:307:1 › no celular, a barra lateral continua como gaveta (1.7s)
  ✓  20 frontend/e2e/form-dialogs.spec.ts:331:5 › janelas sem rolagem horizontal, tema light, desktop (9.3s)
  ✓  21 frontend/e2e/form-dialogs.spec.ts:331:5 › janelas sem rolagem horizontal, tema light, celular (8.9s)
  ✓  22 frontend/e2e/form-dialogs.spec.ts:331:5 › janelas sem rolagem horizontal, tema dark, desktop (9.2s)
  ✓  23 frontend/e2e/form-dialogs.spec.ts:331:5 › janelas sem rolagem horizontal, tema dark, celular (8.8s)
  ✓  24 frontend/e2e/notifications.spec.ts:47:1 › chamado novo sobe o contador, avisa e aparece no sino sem recarregar (1.9s)
  ✓  25 frontend/e2e/notifications.spec.ts:81:1 › o botão do sino tem borda visível e o contador continua legível (1.4s)
  ✓  26 frontend/e2e/notifications.spec.ts:119:1 › assumir pelo sino não muda a tela e "Abrir" leva à conversa (1.8s)
  ✓  27 frontend/e2e/notifications.spec.ts:144:1 › item sai quando outra pessoa assume e volta quando o chamado é devolvido à fila (3.6s)
  ✓  28 frontend/e2e/notifications.spec.ts:175:1 › item sai quando outra pessoa cancela o chamado (2.5s)
  ✓  29 frontend/e2e/notifications.spec.ts:203:1 › quem perde a disputa pelo sino vê o erro dentro da lista (2.6s)
  ✓  30 frontend/e2e/notifications.spec.ts:241:1 › voltar a rede não repete o aviso dos chamados que entraram durante a queda (4.3s)
  ✓  31 frontend/e2e/notifications.spec.ts:270:1 › queda real do WebSocket não repete o aviso quando a conexão reabre (3.4s)
  ✓  32 frontend/e2e/notifications.spec.ts:302:1 › atendente de outro setor não vê o chamado e não vê número desconectado (1.9s)
  ✓  33 frontend/e2e/notifications.spec.ts:319:1 › número desconectado deixa o contador em alerta para o supervisor (1.6s)
  ✓  34 frontend/e2e/notifications.spec.ts:339:1 › administrador vê o número desconectado, com o contador em alerta (1.5s)
  ✓  35 frontend/e2e/notifications.spec.ts:353:1 › administrador vê os chamados de todos os setores, identificados (2.2s)
  ✓  36 frontend/e2e/notifications.spec.ts:371:1 › o sino cabe na largura do celular (1.5s)
  ✓  37 frontend/e2e/select.spec.ts:45:1 › em tela cheia, a lista abre abaixo do campo e escolhe por clique e por teclado (2.4s)
  ✓  38 frontend/e2e/select.spec.ts:77:1 › com o campo no fim da tela, a lista abre acima, sem cobrir o campo (2.2s)
  ✓  39 frontend/e2e/select.spec.ts:99:1 › dentro de janela, a lista abre abaixo do campo e escolhe por clique e por teclado (1.9s)
  ✓  40 frontend/e2e/select.spec.ts:131:1 › dentro de janela, com o campo no fim da tela, a lista abre acima (1.5s)

  40 passed (2.2m)

```
