# Interface geral

Regras que valem para todas as telas: acessibilidade, o comportamento das janelas de formulário e as listas paginadas.

## Regras

1. No menu Configurações, cada pessoa escolhe o tamanho do texto (Padrão, Grande ou Maior) e liga o alto contraste, que vale com o tema claro e com o escuro. A escolha fica no navegador, como o tema.
2. O alvo é atender pessoas com baixa visão.
3. Formulários e consultas que abrem por cima da tela aparecem em uma janela no centro. O painel fixo da conversa (Detalhes, Notas e Histórico) continua onde está.
4. Abrem com bloqueio: encerrar, transferir para atendente ou setor, devolver à fila, cancelar chamado, corrigir atendimento, novo chamado e o cadastro de contato aberto durante um atendimento ou pelo novo chamado. Não há X, e Esc ou clique fora não fecham: a saída é concluir ou usar o botão Cancelar/Voltar.
5. Abrem com fechamento normal: usuários, setores, módulos, assuntos, soluções e a confirmação de exclusão deles, órgãos, contatos e importação pelo menu, desvincular número e histórico. X, Esc e clique fora fecham.
6. Cancelar o cadastro de contato volta à janela de onde ele foi aberto, sem perder o que já estava nela.
7. As listas paginadas mostram 20 itens por página, montadas no servidor, com a faixa "Página X de Y · N itens" e os botões Anterior, os números e Próxima no rodapé. Com tudo numa página, a faixa some.
8. O título de uma coluna ordenável ordena a lista por ela, uma coluna por vez, com uma seta na direção. Clicar de novo inverte a direção; outra coluna começa crescente. A ordem não diferencia maiúsculas nem acentos, e mudar a ordem, a busca ou um filtro volta à página 1.
9. A página e a ordem ficam no endereço da tela (`?pagina=`, `?ordem=`, `?direcao=desc`): recarregar, voltar de outra tela ou abrir o link devolve a mesma lista. Página além da última mostra a última, e o endereço é corrigido.

## Fora do escopo / limites conhecidos

- O sistema não declara conformidade com a ABNT NBR 17225 (ver a issue #112).

## Relacionado

- Design: `design.md`.

## Histórico

- 2026-11-11: listas paginadas e ordenáveis (#126).
- 2026-11-11: regras migradas do `spec.md` (Acessibilidade; Janelas de formulário).
- 2026-11-14: a janela "Nova conversa" passa a "Novo chamado" na regra 4, só texto (ticket [#185](https://github.com/gcaspp-labs/xet/issues/185)).
