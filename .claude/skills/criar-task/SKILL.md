---
name: criar-task
description: Transforma pedidos e ideias em tasks do tasks.md prontas para a skill implementar-task, com as decisões registradas nos documentos, até o PR de documentação aberto. Use quando o usuário chamar /criar-task ou pedir para preparar ou planejar novas tasks.
argument-hint: <descrição do que deve virar task, opcional>
---

# Criar tasks: $ARGUMENTS

A task será implementada por outra sessão, com o contexto zerado, pela skill `/implementar-task`. Ela só conhece o que está no repositório: nenhuma informação pode ficar só nesta conversa ou em arquivo temporário.

Esta skill só escreve documentação. Não implemente nada.

## 1. Reunir os pedidos

1. Use `$ARGUMENTS`, a conversa e o `backlog.md` da raiz, se existir. O `backlog.md` é temporário e não é commitado. Sem nenhum pedido, pergunte o que deve virar task e pare.
2. Se o usuário ainda estiver ditando ideias, só anote no `backlog.md`, com as palavras dele. Ao preparar as tasks, confirme que a lista terminou.

## 2. Levantar o contexto

1. Leia `CLAUDE.md` e, em `tasks.md`, "Como usar" e "Ideias em avaliação". Veja os títulos com `grep -n '^##' tasks.md` e leia duas ou três tasks recentes como modelo.
2. Leia `.claude/skills/implementar-task/SKILL.md`: é ela que vai consumir a task.
3. Liste os títulos de `spec.md`, `modelo-dados.md` e `arquitetura.md` com `grep -n '^##'` e leia as seções do assunto. Procure também o assunto no código, com `grep -rn`, para saber o que já existe.
4. Se o pedido depender de outro repositório ou de uma fonte externa, consulte e registre o que usar. Baixar arquivos exige permissão do usuário.

## 3. Fechar as decisões

Nenhuma task sai com regra de negócio em aberto.

1. Liste o que os documentos não cobrem ou o que contradiz o pedido.
2. Pergunte com `AskUserQuestion`, em opções selecionáveis, até 4 perguntas por vez. A opção recomendada vem primeiro, com "(Recomendado)" no fim do rótulo, e cada opção explica a consequência.
3. Não pergunte o que dá para descobrir nos documentos ou no código, nem detalhe técnico com escolha padrão: decida e informe no resumo final.
4. Se um pedido depender de avaliação que ainda não dá para fazer, como escolher um serviço externo, deixe a avaliação como primeira etapa da task, como na T36, ou mande para "Ideias em avaliação".

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

Numeração, conforme "Como usar" do `tasks.md`: task nova entra com o próximo número. Se precisar vir antes de outras pendentes, as seguintes são renumeradas; concluídas nunca mudam. Um ajuste pequeno de processo pode usar sufixo (T20.1).

Se a task puder rodar antes de pendentes anteriores, diga isso no texto, porque a `/implementar-task` para e pede confirmação ao encontrar task anterior que não esteja `[x]`.

Formato obrigatório, porque a skill localiza as tasks com `grep -n '^### ' tasks.md`:

```markdown
### [ ] T41 — Título curto em português

Contexto ou condição prévia, só quando necessários.

- O que entregar, um item por parte.

**Ler:** spec.md › Seção; modelo-dados.md › `tabela`, Permissões; arquitetura.md › Seção; design.md; código: `core/modulo/arquivo.go`, `db/queries/tabela.sql`, `src/pages/Pagina.tsx`, `e2e/assunto.spec.ts`.

**Pronto quando:** resultados verificáveis, separados por ponto e vírgula, cobrindo cada regra.
```

Regras do conteúdo:

- **Título:** começa com `### [ ] T`, seguido do número e de ` — ` (travessão). A branch sai do título.
- **Tamanho:** cada task cabe em um PR revisável. Separe o que pode ser entregue e testado sozinho e coloque as dependências antes, na ordem de execução.
- **Escopo:** diga o que faz parte e, se houver risco de confusão, o que fica fora. A skill faz só o que a task pede e lê a task seguinte só para saber o que não fazer.
- **"Ler":** os caminhos partem de `backend/internal/`, de `backend/` (em `db/`), de `frontend/` (em `src/`, `e2e/` e `index.html`) e da raiz (em `deploy/` e `.github/`). Cite as seções pelo título exato e os arquivos de partida, inclusive os de teste e um modelo parecido. Com interface, inclua `design.md`.
- **Autossuficiente:** coloque na task links, números, dados conferidos, cuidados e comandos descobertos no levantamento. Não aponte para a conversa, o `backlog.md` ou a pasta temporária.
- **Decisão técnica:** registre o que importa para o resultado. Deixe o resto para a implementação, sem escrever o código na task.
- **"Pronto quando":** toda regra nova precisa de um teste de integração ou ponta a ponta, conforme o `CLAUDE.md`. Regras críticas (concorrência, permissões por setor, idempotência) têm teste específico. O que depender do WhatsApp real ou de serviço externo vira verificação manual explícita.
- **Dados existentes:** se a migração puder falhar ou perder dados, inclusive no banco de desenvolvimento, diga o que fazer. Migração já mergeada nunca é alterada.

Ideia não aprovada vai para "Ideias em avaliação", uma linha em negrito e a explicação.

## 7. Conferir contra a implementar-task

1. Títulos: `grep -n '^### ' tasks.md` mostra as novas tasks na ordem de execução, com `[ ]`.
2. Caminhos: todo arquivo citado em `**Ler:**` existe nas pastas de partida. Arquivo que a própria task vai criar não entra nessa linha.
3. Seções: todo título citado aparece em `grep -n '^##' <documento>`. As tabelas são citadas pelo nome em crase.
4. Documentos: cada regra da task está em `spec.md` ou `modelo-dados.md`, e nenhuma contradiz outra (`grep -n '<termo>' spec.md modelo-dados.md arquitetura.md`).
5. Releia cada task como quem não viu esta conversa: dá para implementar sem perguntar nada?

## 8. Finalizar com o PR

1. Apague o `backlog.md` só depois de confirmar que todo pedido virou regra, task ou ideia em avaliação.
2. Faça o commit em português (`docs: tasks de ...`). Como só muda documentação, não é preciso rodar `make lint` nem `make test`; diga isso no PR.
3. Envie a branch com `git push -u origin <branch>` e abra o PR com `gh pr create --base main`. O corpo traz as tasks criadas, as regras alteradas, as decisões do usuário, o que você decidiu sozinho e o que falta avaliar.
4. Envie uma notificação push curta com o link do PR, dizendo que é só documentação, sem teste manual. As tasks só podem rodar depois do merge, porque a `/implementar-task` parte da main.
5. Responda com o link do PR, a tabela das tasks (número, entrega, dependência) e o comando da próxima, por exemplo `/implementar-task 41`.

Não faça merge do PR. A revisão e o merge são do usuário.
