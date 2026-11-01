---
name: implementar-task
description: Implementa uma task do tasks.md do zero até o PR aberto. Use quando o usuário chamar /implementar-task com o número da task (ex.: /implementar-task 02).
argument-hint: <número da task, ex.: 02>
---

# Implementar task $ARGUMENTS

Você está começando com o contexto zerado. Tudo o que precisa saber está nos documentos do repositório; não presuma nada que não esteja neles.

## 1. Preparar o repositório

1. Normalize o número para dois dígitos (`2` → `02`), mantendo o sufixo, se houver (`20.1`). Se nenhum número foi informado, pergunte qual task implementar e pare.
2. Confira que a árvore de trabalho está limpa (`git status --short`). Se houver alterações não commitadas, pare e pergunte ao usuário o que fazer com elas.
3. Atualize a main: `git checkout main && git pull --ff-only origin main`.
4. Em `tasks.md` (já atualizado da main), verifique:
   - A task `T$ARGUMENTS` existe. Se não existir, pare e avise.
   - Todas as tasks anteriores estão `[x]`. Se alguma não estiver, o PR dela provavelmente ainda não foi mergeado: pare, diga qual está pendente e pergunte se deve seguir mesmo assim.
   - A task não está `[x]`. Se estiver, pare e avise que já foi concluída.
5. Crie a branch a partir da main atualizada: `task/NN-nome-curto` (nome curto em minúsculas, sem acentos, derivado do título da task, ex.: `task/02-banco-de-dados-base`). Se a branch já existir, pare e pergunte se deve continuar nela.

## 2. Carregar o contexto

Leia só o que a task precisa, antes de escrever qualquer código. Ler menos não dispensa nenhuma regra: na dúvida, leia mais ou pergunte.

1. **Sempre:** `CLAUDE.md`, com as regras obrigatórias de implementação, testes, idempotência, concorrência, adaptadores e commits. Em `tasks.md`, a seção inteira da task `T$ARGUMENTS`, incluindo "Ler" e "Pronto quando", e a task seguinte, só para saber o que **não** faz parte desta. Localize as duas com `grep -n '^### ' tasks.md` e leia só esse trecho.
2. **Documentos:** liste os títulos com `grep -n '^##' <documento>` e leia as seções da linha `**Ler:**` da task. Ela é o ponto de partida, não o limite. Sem essa linha, escolha as seções pelos títulos.
3. **Gatilhos:** leia também, mesmo que a linha `**Ler:**` não cite:
   - Regra de negócio nova ou alterada: a seção do assunto em `spec.md`.
   - Permissão ou papel: "Permissões", em `modelo-dados.md`.
   - Situação do chamado: "Ciclo de vida do chamado", em `modelo-dados.md`.
   - Esquema: as tabelas envolvidas e "Tipos enumerados", em `modelo-dados.md`.
   - Auditoria: "`audit_logs`", em `modelo-dados.md`.
   - Interface (telas, componentes ou textos ao usuário): `design.md` inteiro.
   - Adaptador de mensageria, armazenamento ou tempo real: a seção correspondente de `arquitetura.md`.
   - Biblioteca que o projeto ainda não usa: "Bibliotecas padrão", em `arquitetura.md`.
4. **Código:** siga o caminho do assunto, descrito em "Um arquivo por assunto" (`arquitetura.md`): `httpapi/router.go`, `httpapi/<assunto>.go`, `ticket/<assunto>.go` (ou o pacote do domínio), `db/queries/<tabela>.sql` e o teste. Havendo funcionalidade parecida, leia uma como modelo e siga os padrões dela (nomes, organização de pacotes, estilo de testes, tratamento de erros). Veja as assinaturas antes dos corpos (`grep -n '^func'`) e leia por inteiro só o que vai mudar ou servir de modelo.
5. **Antes de mudar** uma função ou uma query, procure quem a usa (`grep -rn <nome> backend frontend`).

## 3. Planejar

1. Monte a lista de passos da task com base nos itens e no "Pronto quando".
2. Se a spec ou o modelo não cobrirem alguma situação necessária, ou se houver contradição entre os documentos, **pare e pergunte** antes de implementar. Registre a decisão no documento correspondente (spec, arquitetura ou modelo) como parte da task. Como você não leu os documentos inteiros, antes de concluir que eles não cobrem o assunto, procure-o neles (`grep -n '<termo>' spec.md modelo-dados.md arquitetura.md`).
3. Anote, para o corpo do PR, o que foi lido e o que ficou de fora, e por quê.
4. Marque a task como `[~]` em `tasks.md`.

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
   - Corpo em português com: resumo do que foi feito; checklist do "Pronto quando" com cada item marcado e como foi verificado; decisões tomadas e documentos alterados; o que foi lido e o que ficou de fora; o que não pôde ser verificado; sugestões fora do escopo.
4. Deixe o ambiente de desenvolvimento pronto para o teste manual:
   - Mantenha a branch da task em checkout.
   - Rode `make dev-restart` (exatamente assim, sem variações, porque é o comando liberado nas permissões). Ele para o ambiente que estiver rodando e sobe de novo em segundo plano: o backend roda com `go run` e não recarrega sozinho, então ficaria sem as mudanças da task.
   - Confirme que `http://gc-11.tail9dcef6.ts.net:5173` responde e que a API tem as rotas novas.
   - Se não for possível reiniciar (por exemplo, permissão negada), não contorne: avise o usuário que o `make dev` precisa ser reiniciado.
5. Envie uma notificação push curta com o link do PR e o link de teste `http://gc-11.tail9dcef6.ts.net:5173`, dizendo se os checks do CI ainda vão rodar. Inclua o e-mail do administrador de teste e diga que a senha está em `.dev-credentials`, na raiz do repositório (arquivo local, ignorado pelo git). Nunca coloque a senha na notificação nem na resposta, e nunca exiba o arquivo na saída de um comando (`cat`, `sed`, `Read`), porque ela ficaria no histórico da sessão. O e-mail sai de `grep '^E-mail:' .dev-credentials`, e o login se confere com o comando abaixo, que mostra só o código HTTP. Se o arquivo não existir ou o login falhar (por exemplo, banco de desenvolvimento recriado), crie o administrador de novo com `make dev-create-admin`, gerando a senha sem exibi-la, grave-a no arquivo com permissão 600 e confirme o login da mesma forma.

   ```bash
   python3 -c "import json,re,urllib.request as r; t=open('.dev-credentials').read(); b=json.dumps({'email':re.search(r'E-mail:\s*(\S+)',t)[1],'password':re.search(r'Senha:\s*(\S+)',t)[1]}).encode(); print(r.urlopen(r.Request('http://localhost:8090/api/auth/login',b,{'Content-Type':'application/json'})).status)"
   ```

6. Responda ao usuário com o link do PR, o link de teste, o e-mail de login e o mesmo resumo, de forma curta.

Não faça merge do PR. A revisão e o merge são do usuário.
