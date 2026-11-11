# Administração

Cadastro de usuários, setores e módulos. O administrador cadastra usuários e setores; o supervisor cuida das listas do próprio setor.

## Regras

1. O administrador cadastra usuários, setores e permissões.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
2. O supervisor gerencia a lista de módulos (sistemas) do próprio setor. As listas são cadastradas no sistema, sem precisar defini-las antes.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
3. O supervisor gerencia também os assuntos e as soluções do próprio setor (ver [subjects.md](subjects.md)).
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
4. Setores são cadastrados e editados pelo nome e por um e-mail opcional, o e-mail universal do setor. Dois setores não podem ter o mesmo e-mail, sem diferenciar maiúsculas.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
5. O e-mail do setor é só cadastro: o sistema não envia nada para ele.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
6. Não há desativação de setor.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
7. Ao cadastrar um usuário, o administrador digita a senha inicial, que segue a regra de complexidade (ver [access.md](access.md)), e a repassa ao usuário.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
8. Cada usuário tem um apelido, que o cliente vê nas mensagens. Ao cadastrar, o formulário sugere o primeiro e o último nome enquanto o administrador digita ("Ana Maria Souza" sugere "Ana Souza"; nome de uma palavra só sugere essa palavra), e ele pode trocar a sugestão.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
9. A sugestão de apelido para de acompanhar o nome assim que o campo é editado à mão. Na edição do usuário, mudar o nome não muda o apelido.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
10. O apelido é opcional no formulário: salvo vazio, o sistema grava o primeiro e o último nome.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
11. Apelidos não se repetem entre usuários, sem diferenciar maiúsculas e contando também os inativos. Apelido em uso é recusado com aviso.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
12. Na implantação do apelido, cada usuário existente recebeu o primeiro e o último nome. Em caso de repetição, o mais antigo ficou com o apelido, e os demais receberam um número no fim ("Ana Souza 2"), que o administrador pode trocar.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
13. Usuários não são excluídos, apenas desativados, e desativar encerra as sessões abertas.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
14. O administrador não pode desativar a própria conta nem alterar o próprio papel, para não perder o acesso à administração.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
15. A desativação ou a troca de setor de um usuário é recusada enquanto ele tiver chamados em atendimento, informando quantos são; os chamados precisam ser transferidos antes.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._
16. A tela de usuários é exclusiva do administrador, que a abre pelo menu Configurações.
   _Fonte: migrada do `spec.md` (Usuários e acesso › Administração) em 2026-11-11._

## Fora do escopo / limites conhecidos

- A redefinição de senha pelo supervisor existe na API, mas ainda não tem tela.

## Relacionado

- Dados: `users`, `sectors`, `modules`, `audit_logs`.

## Histórico

- Nenhuma mudança desde a migração.
