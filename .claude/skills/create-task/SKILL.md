---
name: create-task
description: Transforma pedidos e ideias em issues com o rótulo task, prontas para a skill implement-task, com as decisões registradas nos documentos, até o PR de documentação aberto. Use quando o usuário chamar /create-task ou pedir para preparar ou planejar novas tasks.
argument-hint: <descrição do que deve virar task, opcional>
---

# Criar tasks: $ARGUMENTS

A task será implementada por outra sessão, com o contexto zerado, pela skill `/implement-task`. Ela só conhece o que está no repositório: nenhuma informação pode ficar só nesta conversa ou em arquivo temporário.

Esta skill só escreve documentação. Não implemente nada.

## 1. Reunir os pedidos

1. Use `$ARGUMENTS`, a conversa, as issues com o rótulo `backlog` que o usuário citar (`gh issue view <número>`) e o `backlog.md` da raiz, se existir. O `backlog.md` é temporário e não é commitado. Sem nenhum pedido, pergunte o que deve virar task e pare.
2. Se o usuário ainda estiver ditando ideias, só anote no `backlog.md`, com as palavras dele. Ao preparar as tasks, confirme que a lista terminou.

## 2. Levantar o contexto

1. Leia `CLAUDE.md` e, em `tasks.md`, "Ideias em avaliação". Liste as tasks abertas com `gh issue list --label task --state open` e leia duas ou três como modelo, para não repetir nem contradizer o que já está planejado.
2. Leia `.claude/skills/implement-task/SKILL.md`: é ela que vai consumir a task.
3. Liste os títulos de `spec.md`, `modelo-dados.md` e `arquitetura.md` com `grep -n '^##'` e leia as seções do assunto. Procure também o assunto no código, com `grep -rn`, para saber o que já existe.
4. Se o pedido depender de outro repositório ou de uma fonte externa, consulte e registre o que usar. Baixar arquivos exige permissão do usuário.

## 3. Fechar as decisões

Nenhuma task sai com regra de negócio em aberto.

1. Liste o que os documentos não cobrem ou o que contradiz o pedido.
2. Pergunte com `AskUserQuestion`, em opções selecionáveis, até 4 perguntas por vez. A opção recomendada vem primeiro, com "(Recomendado)" no fim do rótulo, e cada opção explica a consequência.
3. Não pergunte o que dá para descobrir nos documentos ou no código, nem detalhe técnico com escolha padrão: decida e informe no resumo final.
4. Se um pedido depender de avaliação que ainda não dá para fazer, como escolher um serviço externo, deixe a avaliação como primeira etapa da task ou mande para "Ideias em avaliação".

## 4. Preparar a branch

1. Confira `git status --short`. Só o `backlog.md` pode estar fora do commit; com outras alterações, pare e pergunte.
2. Crie a branch a partir da main atualizada, nunca de uma branch de task: `git fetch origin` e `git switch --no-track -c docs/nome-curto origin/main`.

## 5. Registrar as regras

Sempre antes de escrever a task:

- **`spec.md`:** regras de negócio, na seção do assunto. Atualize as regras antigas que mudaram, sem deixar contradição.
- **`modelo-dados.md`:** tabelas, colunas, restrições, índices, permissões, ciclo de vida e ações de auditoria.
- **`arquitetura.md`:** decisões técnicas e bibliotecas novas, com a justificativa.
- **`design.md`:** padrões visuais novos.

## 6. Escrever as tasks

Cada task vira uma issue com o rótulo `task`, e o número da issue é o da task: a issue #80 é a T80. Escreva os textos primeiro, porque as issues só são criadas no passo 8, em ordem de execução.

O título da issue é curto, em português e sem o número. A branch sai dele. Corpo da issue:

```markdown
Contexto ou condição prévia, só quando necessários.

- O que entregar, um item por parte.

**Pedido:** #72

**Plano:** #79

**Depende de:** #80

**Ler:** spec.md › Seção; modelo-dados.md › `tabela`, Permissões; arquitetura.md › Seção; design.md; código: `core/modulo/arquivo.go`, `db/queries/tabela.sql`, `src/pages/Pagina.tsx`, `e2e/assunto.spec.ts`.

**Pronto quando:** resultados verificáveis, separados por ponto e vírgula, cobrindo cada regra.

**Verificação:** automática
```

- **`**Plano:**`:** obrigatório. É o PR de documentação que libera a issue: enquanto ele não tiver merge, a task não roda.
- **`**Pedido:**`:** a issue `backlog` de origem, quando houver.
- **`**Depende de:**`:** só quando houver dependência. As tasks rodam da menor issue para a maior, e só esse campo bloqueia uma task. Task cuja dependência ainda está aberta não roda.

Regras do conteúdo:

- **Tamanho:** cada task cabe em um PR revisável. Separe o que pode ser entregue e testado sozinho e coloque as dependências antes, na ordem de execução.
- **Escopo:** diga o que faz parte e, se houver risco de confusão, o que fica fora. A skill faz só o que a task pede.
- **"Ler":** os caminhos partem de `backend/internal/`, de `backend/` (em `db/`), de `frontend/` (em `src/`, `e2e/` e `index.html`) e da raiz (em `deploy/` e `.github/`). Cite as seções pelo título exato e os arquivos de partida, inclusive os de teste e um modelo parecido. Com interface, inclua `design.md`.
- **Autossuficiente:** coloque na task links, números, dados conferidos, cuidados e comandos descobertos no levantamento. Não aponte para a conversa, o `backlog.md` ou a pasta temporária.
- **Decisão técnica:** registre o que importa para o resultado. Deixe o resto para a implementação, sem escrever o código na task.
- **"Pronto quando":** toda regra nova precisa de um teste de integração ou ponta a ponta, conforme o `CLAUDE.md`. Regras críticas (concorrência, permissões por setor, idempotência) têm teste específico. O que depender do WhatsApp real ou de serviço externo vira verificação manual explícita.
- **"Verificação":** `automática` ou `humana`, decidida aqui e não depois de implementar. Sem o campo, vale `humana`. É `humana` se o "Pronto quando" depender de pessoa, do WhatsApp real, de servidor ou de serviço externo, ou se a task for fora do código. Também é `humana` se ela mudar migração, login, permissões, Whatsmeow, deploy, CI ou as regras dos agentes. Mudança visual pode ser `automática` quando as capturas bastarem para provar. Uma task `automática` entra na esteira do agente chief of staff, que pode fazer o merge sem a pessoa.
- **Dados existentes:** se a migração puder falhar ou perder dados, inclusive no banco de desenvolvimento, diga o que fazer. Migração já mergeada nunca é alterada.

Ideia não aprovada vai para "Ideias em avaliação", no `tasks.md`, uma linha em negrito e a explicação.

## 7. Conferir contra a implement-task

1. Ordem: os textos estão na ordem de execução, porque ela define os números das issues.
2. Caminhos: todo arquivo citado em `**Ler:**` existe nas pastas de partida. Arquivo que a própria task vai criar não entra nessa linha.
3. Seções: todo título citado aparece em `grep -n '^##' <documento>`. As tabelas são citadas pelo nome em crase.
4. Documentos: cada regra da task está em `spec.md` ou `modelo-dados.md`, e nenhuma contradiz outra (`grep -n '<termo>' spec.md modelo-dados.md arquitetura.md`).
5. Verificação: toda task nova tem o campo, coerente com o "Pronto quando" e os arquivos que vai alterar.
6. Releia cada task como quem não viu esta conversa: dá para implementar sem perguntar nada?

## 8. Finalizar com o PR e as issues

1. Apague o `backlog.md` só depois de confirmar que todo pedido virou regra, task ou ideia em avaliação.
2. Faça o commit em português (`docs: tasks de ...`). Como só muda documentação, não é preciso rodar `make lint` nem `make test`; diga isso no PR.
3. Envie a branch com `git push -u origin <branch>` e abra o PR com `gh pr create --base main`. O corpo traz as regras alteradas, as decisões do usuário, o que você decidiu sozinho e o que falta avaliar. Para cada issue `backlog` atendida, escreva `Closes #<número>`.
4. Crie as issues em ordem de execução, com `gh issue create --label task`, já com o número do PR em `**Plano:**`.
5. Edite o corpo do PR com `gh pr edit` e inclua a linha `Tasks: #80, #81`. A trava confere essa linha. Não use `Closes` nas issues `task`: elas fecham com o PR da implementação.
6. Envie uma notificação push curta com o link do PR, dizendo que é só documentação, sem teste manual. As tasks só podem rodar depois do merge, porque a `/implement-task` parte da main.
7. Responda com o link do PR, a tabela das tasks (número, entrega, dependência) e o comando da próxima, por exemplo `/implement-task 80`.

Ajustes em uma issue podem ser feitos até o merge do PR. Se ela for editada depois, a trava chama a pessoa em vez de fazer o merge automático. Para voltar ao automático, abra outro PR de documentação com o ajuste, cite a issue nele e aponte `**Plano:**` para esse PR.

Não faça merge do PR. A revisão e o merge são do usuário.
