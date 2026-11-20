# Usuários e acesso

Como cada funcionário entra no sistema e o que cada papel pode fazer. Vale para atendentes, supervisores e administradores.

## Regras

1. Cada funcionário tem login individual, com e-mail e senha.
2. Não há recuperação automática de senha: administradores e supervisores redefinem a senha quando necessário. Quem redefine digita a nova senha e a repassa ao usuário, e as sessões abertas dele são encerradas. Qualquer usuário também troca a própria senha em Configurações › Alterar senha, informando a senha atual: as outras sessões dele são encerradas e a atual continua. Senha atual errada é recusada e não conta como tentativa de login (regras 6 e 7); a nova senha não pode ser igual à atual.
3. A senha tem no mínimo 8 caracteres, com ao menos uma letra maiúscula, uma minúscula, um número e um caractere especial. É a regra de complexidade adotada pela empresa, como recomenda o guia de segurança da ANPD para agentes de pequeno porte (item 41).
4. A senha não pode ser comum ou fácil de adivinhar (NIST SP 800-63B-4): o sistema recusa senhas de uma lista própria, inclusive com variações de maiúsculas, com números e símbolos no começo ou no fim, ou com letras trocadas por símbolos (`Senha@123`, `P@ssw0rd1!`).
5. As regras de senha valem ao cadastrar, ao redefinir e ao trocar a própria senha; senhas já gravadas continuam valendo.
6. Depois de 5 tentativas de login erradas seguidas com o mesmo e-mail, ou 30 vindas do mesmo IP, o login fica bloqueado por 15 minutos, mesmo com a senha certa. O limite por IP é maior porque um escritório costuma sair por um único IP.
7. Tentativas erradas com mais de 15 minutos deixam de contar, e o login certo zera a contagem do e-mail. E-mail não cadastrado conta da mesma forma, para a resposta não revelar quais e-mails existem.
8. Não há botão de desbloqueio: redefinir a senha do usuário libera o e-mail dele na hora.
9. A sessão expira após 12 horas sem uso, e cada acesso renova o prazo. Sair encerra a sessão imediatamente. Sessões expiradas são apagadas periodicamente, mesmo de quem não volta a entrar.
10. Cada usuário pertence a um único setor, como atendente ou supervisor, e vê apenas as filas e os atendimentos do próprio setor.
11. O administrador funciona como supervisor global: acessa todos os setores, além da administração do sistema.
12. As permissões de cada papel seguem a tabela abaixo. Toda permissão é conferida no backend; a tela só reflete a regra. Editar ou excluir uma mensagem exige ser o responsável atual do chamado em atendimento e ter acesso ao setor dele; consultar as versões e a exclusão de uma mensagem é só leitura e segue o acesso ao chamado.

## Permissões

| Ação | Atendente | Supervisor | Administrador |
| --- | --- | --- | --- |
| Ver fila e chamados | Próprio setor | Próprio setor | Todos os setores |
| Assumir, responder, transferir, encerrar | Próprio setor | Próprio setor | Todos os setores |
| Editar ou excluir mensagem enviada pelo XET | Só sendo o responsável | Só sendo o responsável | Só sendo o responsável |
| Consultar versões e exclusão de uma mensagem | Próprio setor | Próprio setor | Todos os setores |
| Cancelar chamado na fila | Próprio setor | Próprio setor | Todos os setores |
| Cancelar ou devolver à fila chamado em atendimento | Só sendo o responsável | Próprio setor | Todos os setores |
| Corrigir chamado encerrado | Só os que encerrou | Próprio setor | Todos os setores |
| Ver o dashboard do atendimento | — | Próprio setor | Todos os setores |
| Gerenciar módulos | — | Próprio setor | Todos os setores |
| Gerenciar assuntos e soluções pela tela | — | Próprio setor | Todos os setores |
| Adicionar assunto ou solução ao salvar o formulário | Quem pode salvar o formulário | Quem pode salvar o formulário | Quem pode salvar o formulário |
| Redefinir senha | — | Usuários do próprio setor | Todos |
| Alterar a própria senha | Sim | Sim | Sim |
| Conectar e desvincular número (QR code) e ver status | — | Próprio setor | Todos os setores |
| Cadastrar setores e usuários | — | — | Sim |
| Cadastrar contatos e vinculá-los a um órgão | Sim | Sim | Sim |
| Alterar setores e módulos do contato | Próprio setor | Próprio setor | Todos os setores |
| Importar contatos do WhatsApp do setor | Próprio setor | Próprio setor | Todos os setores |
| Cadastrar e editar órgãos | — | Sim | Sim |
| Consultar CNPJ no cadastro de órgão | — | Sim | Sim |

Transferir entre atendentes: o responsável transfere o próprio chamado; supervisor (do setor) e administrador transferem qualquer chamado em atendimento. O destino é um usuário ativo do setor do chamado (atendente ou supervisor).

Encerrar: somente o responsável pelo chamado em atendimento, inclusive quando é supervisor ou administrador.

Editar e excluir mensagem: somente o responsável atual do chamado em atendimento, sobre mensagem enviada pelo XET, inclusive uma enviada por um responsável anterior; supervisor e administrador também precisam ser o responsável. As regras de prazo, estado e alcance estão em [conversation.md](conversation.md), regras 30 a 35.

## Fora do escopo / limites conhecidos

- Não há autenticação em dois fatores.

## Relacionado

- Dados: `users`, `sessions`, `login_attempts`. ADRs: 0004 (IP real do login atrás do túnel).

## Histórico

- 2026-11-11: regras migradas do `spec.md` (Usuários e acesso). A tabela de permissões veio de `docs/data-model.md`.
- 2026-11-19: troca da própria senha em Configurações (regras 2 e 5, tabela de permissões) ([#259](https://github.com/gcaspp-labs/xet/issues/259)).
- 2026-11-20: regra 12 e tabela de permissões alteradas (editar e excluir mensagem exige ser o responsável e ter acesso ao setor; consulta de versões é só leitura); spec [#290](https://github.com/gcaspp-labs/xet/issues/290), tickets [#292](https://github.com/gcaspp-labs/xet/issues/292) e [#294](https://github.com/gcaspp-labs/xet/issues/294), PRs [#301](https://github.com/gcaspp-labs/xet/pull/301) e [#305](https://github.com/gcaspp-labs/xet/pull/305).
