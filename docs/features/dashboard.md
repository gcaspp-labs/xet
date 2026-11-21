# Dashboard do atendimento

Mostra a situação e o desempenho do atendimento, com filtros. Além dos números, mostra ao vivo a fila e os chamados em atendimento, e a fila tem o botão Assumir. É para supervisores e administradores.

## Regras

1. O administrador vê todos os setores, e o supervisor, só o próprio. O atendente não vê: não tem o item no menu, e a API recusa. O Dashboard é um item próprio do menu, fora do grupo Helpdesk, e é a tela inicial do supervisor e do administrador (ver [interface.md](interface.md)).
2. Os filtros são período (hoje, 7 dias, 30 dias ou datas à escolha), setor (só para o administrador), atendente, módulo e órgão. Abre em "Hoje" e, para o administrador, em todos os setores.
3. "7 dias" e "30 dias" contam o dia de hoje. Os dias seguem o horário de Brasília.
4. Atendente e módulo pertencem a um setor: para o administrador, ficam desabilitados até ele escolher um setor, e trocar de setor limpa os dois.
5. Os números refletem os dados atuais do chamado, inclusive depois de uma correção.
6. As seções "Agora" e "No período" podem ser recolhidas. Cada uma começa aberta, e a escolha fica no navegador. Recolhida, a seção mantém o título e, em "No período", as datas. Recolher não muda os filtros nem os números.
7. Os números são os da tabela "Números" abaixo, cada um contado na data indicada, e aparecem no lugar indicado na mesma tabela: no título da lista, em coluna da tabela por atendente ou nas linhas TOTAL e "Do setor". Não há cartões de número.
8. Na visão de todos os setores, uma transferência conta como transferido na origem e recebido no destino. Um chamado recebido do cliente e depois transferido soma dois recebidos, um em cada setor.
9. A espera conta só a primeira vez na fila de cada chamado: o tempo depois de devolver à fila não entra. O chamado transferido tem a espera contada no destino, a partir da transferência.
10. Se a chegada for posterior ao momento em que o chamado foi assumido, por causa do relógio de quem enviou a mensagem, a espera conta como zero.
11. O tempo de atendimento ignora o "Início" editado no formulário, mas respeita o "Fim" editado. Se o "Fim" for anterior ao momento em que o chamado foi assumido, o chamado fica fora da média. Cancelados também ficam fora.
12. Sem chamados para calcular, a média aparece como "—".
13. Cada filtro vale só para os números em que faz sentido, conforme a tabela "Filtros" abaixo. Nos demais, com aquele filtro ativo, aparece "—" com a indicação "Não se aplica ao filtro".
14. O filtro de órgão usa o órgão atual do chamado: chamados sem órgão ficam de fora. Um chamado com vários módulos conta uma vez em cada módulo.
15. A tabela por atendente mostra nome, em atendimento, iniciados, encerrados, transferidos, cancelados e tempo médio de atendimento, com as mesmas regras e filtros. Lista só quem tem algum número diferente de zero. Abaixo das linhas por atendente, a linha **Total** soma cada coluna; o tempo médio de atendimento do Total é a média geral dos chamados do filtro, não a soma das médias das linhas. Quando o Total conta chamados iniciados pelo celular do setor, que não têm pessoa, a linha **Sem atendente** aparece antes do Total com essa diferença em cada coluna, para a soma das linhas por atendente bater com o Total. Abaixo do Total, a linha **Do setor** mostra os números que não pertencem a uma pessoa: Recebidos e Tempo médio de espera. Todas as linhas seguem os filtros e a regra 13.
16. Na visão de todos os setores, cada linha da tabela por atendente é uma pessoa em um setor e mostra o setor.
17. O atendimento é atribuído ao responsável final do chamado, mesmo que ele tenha passado por outras pessoas ou que outra pessoa o tenha cancelado.
18. Os números se atualizam sozinhos quando um chamado muda, sem recarregar a tela.
19. Abaixo de "Agora", o Dashboard mostra duas listas ao vivo: **Fila** e **Em atendimento**, cada uma com a quantidade entre parênteses e em destaque no título. Cada linha mostra contato, protocolo, órgão (ou "Não cadastrado") e há quanto tempo (na fila, desde a chegada; em atendimento, desde que foi assumido, com o responsável, ou "Você"). Na visão de todos os setores, a linha mostra também o setor.
20. As listas seguem os filtros dos números "Na fila" e "Em atendimento" (tabela "Filtros"): a fila, por setor e órgão; os em atendimento, por setor, atendente (responsável atual) e órgão. Período e módulo não se aplicam a elas, e a quantidade no título é a da lista. Se nada está na fila, aparece "Nenhum chamado na fila"; se nada está em atendimento, "Nenhum chamado em atendimento".
21. Na Fila, o botão Assumir é o botão de destaque (variante primary) e segue a mesma regra de permissão de assumir de [queue.md](queue.md): ao assumir, aparece o aviso "Chamado assumido" e o chamado abre em Chamados (`/chamados/:id`). Clicar na linha, fora do botão, abre o chamado ali, tanto na Fila quanto em Em atendimento. As listas se atualizam sozinhas, como os números (regra 18).
22. As listas mostram 5 chamados por página, os mais recentes primeiro (pela chegada), com paginação independente e altura fixa entre as páginas. A paginação é feita no navegador, sobre a lista que a API já devolve: é a exceção à regra 7 de [interface.md](interface.md), que manda paginar no servidor, de 20 em 20. A faixa e os botões seguem os do resto do sistema. A página de cada lista fica no endereço, com parâmetro próprio (`?paginaFila=` e `?paginaAtendimento=`), como na regra 9 de [interface.md](interface.md): recarregar, voltar de outra tela ou abrir o link devolve a mesma página, recolher e reabrir a seção não a perde, e uma página além da última mostra a última com o endereço corrigido. Mudar qualquer filtro volta as duas listas à primeira página, com a seção recolhida ou não: a limpeza é feita junto do filtro, fora das listas, que desmontam ao recolher.

## Números

| Número | Conta | Data que entra no período | Onde aparece |
| --- | --- | --- | --- |
| Na fila | Chamados na fila agora | Não muda com o período | Título da lista Fila |
| Em atendimento | Chamados em atendimento agora | Não muda com o período | Título da lista Em atendimento; coluna e Total da tabela por atendente |
| Recebidos | Chamados vindos do cliente ou de transferência de outro setor | Chegada | Linha "Do setor" |
| Iniciados | Chamados iniciados pela equipe, no sistema ou pelo celular do setor | Chegada | Coluna e Total da tabela por atendente; linha "Sem atendente" quando iniciado pelo celular do setor |
| Encerrados | Encerramentos pelo formulário | Momento real do encerramento | Coluna e Total da tabela por atendente |
| Transferidos | Transferências para outro setor; a troca de atendente não conta, porque o chamado continua aberto | Momento real do encerramento | Coluna e Total da tabela por atendente |
| Cancelados | Cancelamentos | Momento real do encerramento | Coluna e Total da tabela por atendente |
| Tempo médio de espera | Da chegada até a primeira vez que alguém assumiu, nos chamados recebidos | Momento em que foi assumido | Linha "Do setor" |
| Tempo médio de atendimento | De quando foi assumido até o "Fim" do formulário, nos encerrados, e até o momento da transferência, nos transferidos | Momento real do encerramento | Coluna e Total da tabela por atendente (no Total, a média geral) |

## Filtros

| Número | Setor | Atendente | Módulo | Órgão |
| --- | --- | --- | --- | --- |
| Na fila | Sim | Não se aplica | Não se aplica | Sim |
| Em atendimento | Sim | Responsável atual | Não se aplica | Sim |
| Recebidos | Sim | Não se aplica | Não se aplica | Sim |
| Iniciados | Sim | Quem iniciou no sistema | Não se aplica | Sim |
| Encerrados | Sim | Responsável | Sim | Sim |
| Transferidos | Sim | Responsável | Sim | Sim |
| Cancelados | Sim | Responsável | Não se aplica | Sim |
| Tempo médio de espera | Sim | Não se aplica | Não se aplica | Sim |
| Tempo médio de atendimento | Sim | Responsável | Sim | Sim |

## Fora do escopo / limites conhecidos

- A carga de cada atendente fica na coluna "em atendimento" da tabela por atendente; não há cartão separado para isso.
- Como há atendimentos simultâneos, o tempo de atendimento não representa trabalho exclusivo naquele cliente.

## Relacionado

- Dados: `tickets`, `ticket_modules`, `messages` (calculado na hora, sem tabela própria). ADRs: 0003.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Dashboard do atendimento).
- 2026-11-18: linha "Tempo médio de atendimento" da tabela de números alterada; spec [#243](https://github.com/gcaspp-labs/xet/issues/243), PR [#250](https://github.com/gcaspp-labs/xet/pull/250). Dizia "De quando foi assumido até o \"Fim\" do formulário, em encerrados e transferidos".
- 2026-11-18: regra 1 alterada (acrescentado o item de menu e a tela inicial) e regras 19 a 21 acrescentadas (listas Fila e Em atendimento, com Assumir); o cabeçalho dizia "É só leitura, para supervisores e administradores."; spec [#159](https://github.com/gcaspp-labs/xet/issues/159), PRs [#171](https://github.com/gcaspp-labs/xet/pull/171) e [#170](https://github.com/gcaspp-labs/xet/pull/170).
- 2026-11-21: regra 7 alterada (sem cartões; cada número no seu lugar), regra 15 alterada (linhas Total e "Do setor") e regra 22 acrescentada (paginação de 5 em 5 no navegador, os mais recentes primeiro e altura fixa, exceção à regra 7 de [interface.md](interface.md)), com as regras 19 a 21 ajustadas (quantidade entre parênteses no título, lista sem período e módulo e Assumir primary); a tabela "Números" ganhou a coluna "Onde aparece". Ticket [#223](https://github.com/gcaspp-labs/xet/issues/223).
- 2026-11-21: regra 15 ajustada (linha **Sem atendente**, para os iniciados pelo celular do setor, que não têm pessoa, e a soma das linhas bater com o Total), regra 22 ajustada (página de cada lista no endereço, em `?paginaFila=` e `?paginaAtendimento=`, como na regra 9 de [interface.md](interface.md)) e a linha "Iniciados" da tabela "Números" aponta a linha nova. Revisão do PR [#359](https://github.com/gcaspp-labs/xet/pull/359), ticket [#223](https://github.com/gcaspp-labs/xet/issues/223).
- 2026-11-21: regra 22 ajustada (a limpeza das páginas ao mudar um filtro é feita junto do filtro, fora das listas, e vale também com a seção "Agora" recolhida), e os iniciados pelo celular do setor passam a ser semeados no teste ponta a ponta pela rota `send-outside` do adaptador falso, sem alterar a resposta da API. Revisão do PR [#359](https://github.com/gcaspp-labs/xet/pull/359), ticket [#223](https://github.com/gcaspp-labs/xet/issues/223).
