---
name: implementar-task
description: Implementa uma task do tasks.md do zero até o PR aberto. Use quando o usuário chamar /implementar-task com o número da task (ex.: /implementar-task 02).
argument-hint: <número da task, ex.: 02>
---

# Implementar task $ARGUMENTS

Você está começando com o contexto zerado. Tudo o que precisa saber está nos documentos do repositório; não presuma nada que não esteja neles.

## 1. Preparar o repositório

1. Normalize o número para dois dígitos (`2` → `02`). Se nenhum número foi informado, pergunte qual task implementar e pare.
2. Confira que a árvore de trabalho está limpa (`git status --short`). Se houver alterações não commitadas, pare e pergunte ao usuário o que fazer com elas.
3. Atualize a main: `git checkout main && git pull --ff-only origin main`.
4. Em `tasks.md` (já atualizado da main), verifique:
   - A task `T$ARGUMENTS` existe. Se não existir, pare e avise.
   - Todas as tasks anteriores estão `[x]`. Se alguma não estiver, o PR dela provavelmente ainda não foi mergeado: pare, diga qual está pendente e pergunte se deve seguir mesmo assim.
   - A task não está `[x]`. Se estiver, pare e avise que já foi concluída.
5. Crie a branch a partir da main atualizada: `task/NN-nome-curto` (nome curto em minúsculas, sem acentos, derivado do título da task, ex.: `task/02-banco-de-dados-base`). Se a branch já existir, pare e pergunte se deve continuar nela.

## 2. Carregar o contexto

Leia por completo, nesta ordem, antes de escrever qualquer código:

1. `CLAUDE.md`: regras de implementação, testes, idempotência, concorrência, adaptadores e commits. Elas são obrigatórias.
2. `tasks.md`: a seção inteira da task `T$ARGUMENTS`, incluindo "Pronto quando". Leia também a task seguinte, só para saber o que **não** faz parte desta.
3. `spec.md`: as regras de negócio envolvidas na task.
4. `arquitetura.md`: componentes, adaptadores, bibliotecas permitidas e estrutura do repositório.
5. `modelo-dados.md`: tabelas, restrições, permissões e ciclo do chamado envolvidos na task.
6. `design.md`: obrigatório quando a task tiver interface (telas, componentes ou textos ao usuário).

Depois, explore o código existente que a task vai tocar e siga os padrões já estabelecidos (nomes, organização de pacotes, estilo de testes, tratamento de erros).

## 3. Planejar

1. Monte a lista de passos da task com base nos itens e no "Pronto quando".
2. Se a spec ou o modelo não cobrirem alguma situação necessária, ou se houver contradição entre os documentos, **pare e pergunte** antes de implementar. Registre a decisão no documento correspondente (spec, arquitetura ou modelo) como parte da task.
3. Marque a task como `[~]` em `tasks.md`.

## 4. Implementar

- Escopo estrito: somente o que a task pede. Melhorias percebidas fora do escopo vão para o resumo final como sugestão, não para o código.
- Apenas bibliotecas listadas em `arquitetura.md`. Se precisar de outra, pare e pergunte; se aprovada, registre-a lá com a justificativa.
- Mudanças de esquema somente por migração goose, seguindo `modelo-dados.md`. Se o modelo precisar mudar, atualize `modelo-dados.md` primeiro.
- Aplique as regras de idempotência, concorrência e ACID do `CLAUDE.md` em toda operação que grava dados.
- Faça commits pequenos e coerentes ao longo do trabalho, no padrão Conventional Commits em português.

## 5. Testar e validar

1. Escreva os testes exigidos pelo `CLAUDE.md`: integração no backend (banco PostgreSQL real e próprio para os testes), Playwright no frontend quando a task tiver interface.
2. Rode `make lint` e `make test`. Tudo precisa passar; não desative regras de lint nem pule testes para fazer passar.
3. Percorra cada item de "Pronto quando" e confirme, com evidência (saída de teste, comando executado), que está atendido. Se algum não puder ser verificado (ex.: depende do número real de WhatsApp), anote para o resumo.

## 6. Finalizar com o PR

1. Marque a task como `[x]` em `tasks.md` e faça o commit final.
2. Envie a branch: `git push -u origin <branch>`.
3. Abra o PR para a `main` com `gh pr create`:
   - Título: `T$ARGUMENTS — <título da task>`.
   - Corpo em português com: resumo do que foi feito; checklist do "Pronto quando" com cada item marcado e como foi verificado; decisões tomadas e documentos alterados; o que não pôde ser verificado; sugestões fora do escopo.
4. Deixe o ambiente de desenvolvimento pronto para o teste manual:
   - Mantenha a branch da task em checkout.
   - Rode `make dev-restart` (exatamente assim, sem variações, porque é o comando liberado nas permissões). Ele para o ambiente que estiver rodando e sobe de novo em segundo plano: o backend roda com `go run` e não recarrega sozinho, então ficaria sem as mudanças da task.
   - Confirme que `http://gc-11.tail9dcef6.ts.net:5173` responde e que a API tem as rotas novas.
   - Se não for possível reiniciar (por exemplo, permissão negada), não contorne: avise o usuário que o `make dev` precisa ser reiniciado.
5. Envie uma notificação push curta com o link do PR e o link de teste `http://gc-11.tail9dcef6.ts.net:5173`, dizendo se os checks do CI ainda vão rodar. Inclua o e-mail do administrador de teste e diga que a senha está em `.dev-credentials`, na raiz do repositório (arquivo local, ignorado pelo git). Nunca coloque a senha na notificação nem na resposta. Se o arquivo não existir ou o login falhar (por exemplo, banco de desenvolvimento recriado), crie o administrador de novo com `make dev-create-admin`, gerando a senha sem exibi-la, grave-a no arquivo com permissão 600 e confirme o login pela API.
6. Responda ao usuário com o link do PR, o link de teste, o e-mail de login e o mesmo resumo, de forma curta.

Não faça merge do PR. A revisão e o merge são do usuário.
