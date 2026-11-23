# Notificações

O sino do cabeçalho e os alertas do navegador avisam dos chamados na fila, dos números desconectados e das mensagens novas nos chamados de quem é o responsável. As mensagens não lidas de cada chamado aparecem em "Meus chamados" (ver [queue.md](queue.md), regra 19).

## Regras

1. O sino do cabeçalho está em todas as telas. Clicar nele abre a lista; o contador soma os chamados na fila e os números desconectados.
2. Cada chamado na fila é um item com o contato, a prévia da última mensagem e os botões "Abrir" e "Assumir".
3. O item existe enquanto o chamado estiver na fila, inclusive devolvido ou transferido, e sai quando alguém assume ou cancela. Não há lido nem histórico.
4. Atendentes e supervisores veem a fila do próprio setor.
5. O administrador não recebe aviso de chamados: o sino dele não tem item nem contador de chamados, só o número desconectado, e não há aviso, som nem notificação do navegador. Em "Meus chamados" ele vê o contador de não lidas quando é o responsável, sem os alertas. Ele acompanha o atendimento pelo dashboard e pelo painel.
6. Ao entrar um chamado na fila, além do contador, aparece um aviso breve, sem botão, para evitar assumir sem querer ao digitar.
7. Abrir a tela ou recuperar a conexão não avisa dos chamados que já estavam na fila.
8. Número desconectado é um item fixo no topo da lista, só para supervisores e administradores, que leva à tela de conexão do setor.
9. O item de número desconectado fica até o número conectar, inclusive enquanto a conexão está em andamento e na própria tela de conexão. Enquanto houver número desconectado, o contador fica na cor de alerta.
10. Quem ativar recebe a notificação do navegador com a aba em segundo plano, com o nome do contato e sem o texto da mensagem, e um som curto ao entrar um chamado na fila. A mesma notificação e o mesmo som avisam de mensagem nova do cliente num chamado de que a pessoa é responsável, menos com esse chamado aberto e a aba visível; o clique na notificação abre o chamado em `/chamados/:id`, e cada mensagem toca e notifica uma vez só, mesmo com várias abas abertas.
11. O título da aba mostra o contador, somando as não lidas dos meus chamados; o contador do sino continua só com a fila e os números desconectados (regra 1).
12. Cada pessoa liga ou desliga os alertas do navegador no menu Configurações, e a escolha fica no navegador. As opções não aparecem para o administrador.
13. Cada chamado em atendimento guarda no servidor até quando o responsável leu, e as não lidas são as mensagens recebidas do cliente gravadas depois desse momento. Contam todos os tipos de mensagem recebida, inclusive arquivo que não pôde ser baixado e tipo não suportado; não contam as mensagens enviadas pelo XET ou pelo celular do setor, os avisos do sistema e as reações, edições e exclusões.
14. Uma mensagem conta como lida quando o responsável abre o chamado com a aba visível, quando volta à aba com ele aberto e quando chega mensagem nova com o chamado aberto e a aba visível. Com o chamado aberto e a aba em segundo plano, a mensagem nova conta como não lida até ela voltar, e abrir o chamado de outra pessoa não zera as não lidas do responsável.
15. As não lidas ficam no servidor: continuam depois de recarregar a página e em outro computador, e ler numa aba atualiza as outras do mesmo usuário sem recarregar. Abrir a tela e recuperar a conexão não avisam das não lidas que já existiam.
16. A contagem começa do zero para o novo responsável ao assumir da fila, receber por transferência entre atendentes, criar o chamado pelo atendente ou retomar um pendente; na fila e no pendente não há não lidas. Devolver à fila ou deixar pendente apaga a leitura.

## Fora do escopo / limites conhecidos

- Com o sistema fechado, não há aviso.
- Não lidas só em "Meus chamados": não há contador no sino, em Atendimentos, no Dashboard nem na aba Fila. Não há como marcar um chamado como não lido, e a leitura é do chamado inteiro, não de cada mensagem.

## Relacionado

- ADRs: 0003 (o sino compara a fila recarregada com a anterior).
- "Meus chamados": [queue.md](queue.md), regra 19 (o contador no item).
- Dados: `tickets.assignee_read_at` (o momento da leitura do responsável), em `docs/data-model.md`.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Recebimento e distribuição › Notificações).
- 2026-11-23: a introdução passou a citar também as mensagens novas nos chamados do responsável e as não lidas em "Meus chamados"; dizia "O sino do cabeçalho e os alertas do navegador avisam dos chamados na fila e dos números desconectados.". Regra 5 alterada: dizia "O administrador não recebe notificação de chamados: não há item, contador, aviso, som nem notificação do navegador. O sino dele mostra só número desconectado, e ele acompanha o atendimento pelo dashboard e pelo painel."; o comportamento é o mesmo, só ficou explícito que o contador de "Meus chamados" aparece para ele sem os alertas. Regra 10 alterada: terminava em "e um som curto ao entrar um chamado na fila." e passou a valer também para mensagem nova do cliente num chamado do responsável. Regra 11 alterada: dizia "O título da aba mostra o contador." e passou a somar as não lidas dos meus chamados. Regras 13 a 16 acrescentadas (não lidas no servidor, o que conta, quando conta como lida, o recomeço ao assumir ou receber o chamado). Spec [#310](https://github.com/gcaspp-labs/xet/issues/310), tickets [#313](https://github.com/gcaspp-labs/xet/issues/313), [#314](https://github.com/gcaspp-labs/xet/issues/314) e [#315](https://github.com/gcaspp-labs/xet/issues/315), PRs [#383](https://github.com/gcaspp-labs/xet/pull/383), [#390](https://github.com/gcaspp-labs/xet/pull/390) e [#391](https://github.com/gcaspp-labs/xet/pull/391). A retomada de um pendente recomeçando a leitura (regra 16) veio da [#334](https://github.com/gcaspp-labs/xet/issues/334), da spec [#332](https://github.com/gcaspp-labs/xet/issues/332), PR [#386](https://github.com/gcaspp-labs/xet/pull/386).
