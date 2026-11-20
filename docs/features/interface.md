# Interface geral

Regras que valem para todas as telas: acessibilidade, o comportamento das janelas de formulário e as listas paginadas.

## Regras

1. No menu Configurações, cada pessoa escolhe o tamanho do texto (Padrão, Grande ou Maior) e liga o alto contraste, que vale com o tema claro e com o escuro. A escolha fica no navegador, como o tema.
2. O alvo é atender pessoas com baixa visão.
3. Formulários e consultas que abrem por cima da tela aparecem em uma janela no centro.
4. Abrem com bloqueio: encerrar, transferir para atendente ou setor, devolver à fila, cancelar chamado, corrigir atendimento, novo chamado e o cadastro de contato aberto durante um atendimento ou pelo novo chamado. Não há X, e Esc ou clique fora não fecham: a saída é concluir ou usar o botão Cancelar/Voltar.
5. Abrem com fechamento normal: usuários, setores, módulos, assuntos, soluções e a confirmação de exclusão deles, órgãos, contatos e importação pelo menu, desvincular número, histórico, excluir mensagem e as versões e a exclusão de uma mensagem. X, Esc e clique fora fecham.
6. Cancelar o cadastro de contato volta à janela de onde ele foi aberto, sem perder o que já estava nela.
7. As listas paginadas mostram 20 itens por página, montadas no servidor, com a faixa "Página X de Y · N itens" e os botões Anterior, os números e Próxima no rodapé. Com tudo numa página, a faixa some.
8. O título de uma coluna ordenável ordena a lista por ela, uma coluna por vez, com uma seta na direção. Clicar de novo inverte a direção; outra coluna começa crescente. A ordem não diferencia maiúsculas nem acentos, e mudar a ordem, a busca ou um filtro volta à página 1.
9. A página e a ordem ficam no endereço da tela (`?pagina=`, `?ordem=`, `?direcao=desc`): recarregar, voltar de outra tela ou abrir o link devolve a mesma lista. Página além da última mostra a última, e o endereço é corrigido.
10. Qualquer endereço que não existe (digitado errado, link quebrado ou antigo) mostra a mesma tela Não encontrado, dentro do menu lateral e com o botão Voltar, que volta à página anterior do navegador ou, sem página anterior, ao início. Quem está sem sessão vai ao login, e quem abre uma tela que o seu perfil não vê volta ao início, como antes.
11. O menu lateral tem o Dashboard como item próprio, no alto, fora do grupo Helpdesk, só para supervisor e administrador. O grupo Helpdesk tem Atendimentos e Chamados (ver [queue.md](queue.md)).
12. Ao entrar (e ao abrir `/`), o supervisor e o administrador vão ao Dashboard, e o atendente vai a Chamados. O atendente não tem Dashboard: o item não aparece e a API recusa.
13. O menu ⋯ ("Ações da mensagem") fica ao lado do balão de cada mensagem enviada pelo XET, aparece ao passar o mouse, ao focar pelo teclado e enquanto está aberto, e reúne Responder, Editar e Excluir, com o motivo de uma ação indisponível separado por um divisor. Ele só existe nas condições da regra 30 de [conversation.md](conversation.md), e o foco volta ao botão do menu ao fechar a janela.
14. A edição toma o lugar do compositor, na mesma área: a faixa "Editando", com o autor, um trecho da mensagem e Cancelar, e o campo já com o texto ou a legenda atual, sem o apelido. Enter salva, Esc cancela, salvar fica indisponível sem alteração, o texto não pode ficar vazio (a legenda de um anexo pode, preservando o arquivo e o apelido), e o rascunho que estava no campo volta ao cancelar ou ao salvar (regras 31 e 32 de [conversation.md](conversation.md)).
15. A janela "Excluir mensagem" (regra 34 de [conversation.md](conversation.md)) oferece só as opções elegíveis e Cancelar, explica o alcance de "para mim" e não promete apagar a mensagem de outros aparelhos. Enquanto a confirmação corre, ela não fecha nem repete, e a falha mantém a janela aberta com o motivo. A janela das versões e da exclusão, em Atendimentos, é só leitura e fecha por Fechar, X, Esc ou clique fora.

## Fora do escopo / limites conhecidos

- O sistema não declara conformidade com a ABNT NBR 17225 (ver a issue #112).

## Relacionado

- Design: `design.md`.

## Histórico

- 2026-11-11: listas paginadas e ordenáveis (#126).
- 2026-11-11: regras migradas do `spec.md` (Acessibilidade; Janelas de formulário).
- 2026-11-14: a janela "Nova conversa" passa a "Novo chamado" na regra 4, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)).
- 2026-11-15: regra 3 alterada e regra 10 acrescentada (tela global Não encontrado); spec [#173](https://github.com/gcaspp-labs/xet/issues/173), PR [#191](https://github.com/gcaspp-labs/xet/pull/191). A regra 3 dizia "Formulários e consultas que abrem por cima da tela aparecem em uma janela no centro. O painel fixo da conversa (Detalhes, Notas e Histórico) continua onde está.".
- 2026-11-18: regras 11 e 12 acrescentadas (menu com o Dashboard fora do Helpdesk e tela inicial por perfil); spec [#159](https://github.com/gcaspp-labs/xet/issues/159), PR [#170](https://github.com/gcaspp-labs/xet/pull/170).
- 2026-11-20: regra 5 alterada e regras 13 a 15 acrescentadas (menu da mensagem, edição no compositor e janela de exclusão, conforme o protótipo aprovado); spec [#290](https://github.com/gcaspp-labs/xet/issues/290), tickets [#293](https://github.com/gcaspp-labs/xet/issues/293) e [#294](https://github.com/gcaspp-labs/xet/issues/294), PRs [#303](https://github.com/gcaspp-labs/xet/pull/303) e [#305](https://github.com/gcaspp-labs/xet/pull/305). A regra 5 terminava em "desvincular número e histórico."
