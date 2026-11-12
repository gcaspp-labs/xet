# Assuntos e soluções

Cada setor tem uma lista de assuntos, e cada assunto, uma lista de soluções, sugeridas no formulário de encerramento. O supervisor cuida das listas do setor pela tela Assuntos. Durante o atendimento, quem responde o chamado consulta e copia as soluções do setor pela aba Assuntos do cartão Chamado.

## Regras

1. Cada setor tem sua lista de assuntos, e cada assunto, sua lista de soluções. As duas começam vazias.
2. O supervisor gerencia a lista do próprio setor, e o administrador, as de todos os setores, pela tela Assuntos. O atendente não abre essa tela: usa a lista do setor do chamado no formulário, e também a consulta, só para leitura, na aba Assuntos do cartão Chamado (regra 18). Ele só acrescenta itens pela pergunta ao salvar.
3. As listas valem no encerramento, na transferência entre setores (lista do setor de origem) e na correção, que usam o mesmo formulário. O cancelamento não tem assunto.
4. O campo Assunto sugere os assuntos do setor enquanto a pessoa digita, e ela pode escolher um ou escrever outro. Nenhum vem marcado.
5. Com um assunto da lista que tenha soluções, aparece a escolha "Soluções sugeridas". Escolher uma substitui o texto do campo Resolução, que continua editável. Trocar de assunto não apaga a Resolução.
6. Um texto é igual a um item da lista quando coincidem, depois de tirar os espaços das pontas e sem diferenciar maiúsculas. Assuntos não se repetem no setor, nem soluções no assunto, pela mesma comparação.
7. Com o formulário válido e antes de gravar, se o assunto não estiver na lista, o sistema pergunta se deve adicioná-lo. Depois, se a resolução não estiver na lista do assunto, pergunta se deve adicioná-la, inclusive quando for uma solução da lista com o texto alterado.
8. As opções da pergunta são adicionar, não adicionar e voltar ao formulário, sem salvar nada.
9. Se o assunto não entrar na lista, não há a pergunta da solução.
10. Na correção, só há pergunta para o assunto ou a resolução alterados na própria correção.
11. Ao responder "adicionar", o item entra na lista junto com o salvamento do formulário e vale para todos os papéis. Se o chamado não for salvo, nada entra.
12. Se outra pessoa já tiver adicionado o mesmo item, ele fica como está e o chamado é salvo normalmente. Se o assunto da solução tiver sido excluído nesse meio-tempo, a solução não é adicionada e o chamado é salvo normalmente.
13. Os chamados guardam o próprio texto, sem ligação com as listas: editar ou excluir um item não altera nenhum chamado.
14. Excluir apaga de verdade, depois de uma confirmação, e não pode ser desfeito. Excluir um assunto apaga também as soluções dele, e a confirmação avisa quantas são. A exclusão fica registrada na auditoria.
15. Assunto tem até 500 caracteres e solução até 10.000, como no formulário. Texto maior não entra na lista e não impede salvar o chamado.
16. A tela Assuntos mostra os assuntos do setor com as soluções de cada um e permite adicionar, editar e excluir os dois. O administrador escolhe o setor.
17. A busca da tela Assuntos não diferencia acentos nem maiúsculas: um assunto encontrado pelo nome aparece com todas as soluções; encontrado por uma solução, aparece só com as soluções que batem.
18. O cartão Chamado tem a aba Assuntos, ao lado de Detalhes, Notas e Histórico, só para quem pode encerrar o chamado (ver [closing.md](closing.md)); para os demais, a aba não aparece. Ela mostra todos os assuntos do setor do chamado, cada um com as suas soluções, só para leitura: não cria, edita nem exclui nada. O chat continua visível e utilizável com a aba aberta. Em tela larga, a coluna do cartão fica mais larga com a aba Assuntos ativa e volta ao tamanho normal nas outras; em tela estreita (abaixo de 1024 px), o cartão fica embaixo do chat, como sempre.
19. Cada solução da aba tem o botão Copiar, que leva o texto inteiro e exato (até 10.000 caracteres) para a área de transferência e mostra um aviso curto de confirmação. Nada é inserido na caixa do chat. Solução longa aparece resumida, com "Ver texto inteiro" para expandir.
20. A busca da aba segue a regra 17. Setor sem assuntos mostra o aviso "Este setor ainda não tem assuntos cadastrados"; busca sem resultado mostra "Nenhum assunto ou solução encontrado".
21. A aba aberta e o texto da busca são lembrados por chamado, só no navegador de quem está pesquisando, e nada vai para o servidor. Abrir um chamado ainda não visitado começa na aba padrão (Detalhes); voltar a um já visto restaura a aba e a busca dele. Recarregar a página ou sair do sistema apaga esse estado.

## Fora do escopo / limites conhecidos

- A aba Assuntos não preenche o formulário de encerramento nem insere a solução direto no chat: só copia.
- A aba não mostra assuntos de outros setores nem tem paginação: a lista vem completa.
- O estado da aba e da busca não é guardado no servidor, não passa entre dispositivos e não sobrevive a recarregar a página.

## Relacionado

- Glossário: Assunto, Solução. Formulário de encerramento: [closing.md](closing.md).
- Dados: `subjects`, `subject_solutions`, `audit_logs`.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Formulário de encerramento › Assuntos e soluções).
- 2026-11-12: regras 18 a 21 acrescentadas (consulta durante o atendimento); a regra 2 dizia "O supervisor gerencia a lista do próprio setor, e o administrador, as de todos os setores, pela tela Assuntos. O atendente não abre essa tela: usa a lista do setor do chamado no formulário e só acrescenta itens pela pergunta ao salvar."; mudança da spec #134, PR #136.
