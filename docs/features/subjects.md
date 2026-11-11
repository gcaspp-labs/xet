# Assuntos e soluções

Cada setor tem uma lista de assuntos, e cada assunto, uma lista de soluções, sugeridas no formulário de encerramento. O supervisor cuida das listas do setor pela tela Assuntos.

## Regras

1. Cada setor tem sua lista de assuntos, e cada assunto, sua lista de soluções. As duas começam vazias.
2. O supervisor gerencia a lista do próprio setor, e o administrador, as de todos os setores, pela tela Assuntos. O atendente não abre essa tela: usa a lista do setor do chamado no formulário e só acrescenta itens pela pergunta ao salvar.
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

## Fora do escopo / limites conhecidos

- Nenhum registrado.

## Relacionado

- Dados: `subjects`, `subject_solutions`, `audit_logs`.

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Formulário de encerramento › Assuntos e soluções).
