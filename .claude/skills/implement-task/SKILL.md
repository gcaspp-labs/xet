---
name: implement-task
description: Implementa uma task, que é uma issue com o rótulo task, do zero até o PR aberto. Use quando o usuário chamar /implement-task com o número da issue (ex.: /implement-task 80).
argument-hint: <número da issue, ex.: 80>
---

# Implementar task $ARGUMENTS

Você está começando com o contexto zerado. Tudo o que precisa saber está nos documentos do repositório; não presuma nada que não esteja neles.

## 1. Preparar o repositório

1. O número da task é o da issue. Se nenhum número foi informado, pergunte qual task implementar e pare.
2. Confira que a árvore de trabalho está limpa (`git status --short`). Se houver alterações não commitadas, pare e pergunte ao usuário o que fazer com elas.
3. Atualize a main: `git checkout main && git pull --ff-only origin main`.
4. Leia a issue com `gh issue view $ARGUMENTS --json title,state,labels,body` e verifique:
   - A issue existe e tem o rótulo `task`. Se não, pare e avise.
   - Ela está aberta. Se estiver fechada, pare e avise que já foi concluída.
   - O PR de `**Plano:**` teve merge (`gh pr view <número> --json state`). Se não, pare e avise: os documentos da task ainda não estão na main.
   - Cada issue de `**Depende de:**` está fechada. Se alguma não estiver, pare, diga qual está pendente e pergunte se deve seguir mesmo assim. Sem esse campo, a task não depende de outra.
5. Crie a branch a partir da main atualizada: `task/NN-nome-curto` (nome curto em minúsculas, sem acentos, derivado do título da issue, ex.: `task/80-apelido-nas-mensagens`). Se a branch já existir, pare e pergunte se deve continuar nela.

## 2. Carregar o contexto

Leia só o que a task precisa, antes de escrever qualquer código. Ler menos não dispensa nenhuma regra: na dúvida, leia mais ou pergunte.

1. **Sempre:** `CLAUDE.md`, com as regras obrigatórias de implementação, testes, idempotência, concorrência, adaptadores e commits. A issue inteira, incluindo "Ler" e "Pronto quando". Com `gh issue list --label task --state open`, veja os títulos das outras tasks abertas, só para saber o que **não** faz parte desta.
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
4. **Código:** siga o caminho do assunto, descrito em "Um arquivo por assunto" (`arquitetura.md`): `server/server.go`, `routes.go` do módulo (ou `Routes` em `<assunto>_http.go`, no `core`), `helpdesk/<assunto>_http.go`, `helpdesk/<assunto>.go` (ou o pacote de `core`), `db/queries/<tabela>.sql` e `<assunto>_test.go`. Havendo funcionalidade parecida, leia uma como modelo e siga os padrões dela (nomes, organização de pacotes, estilo de testes, tratamento de erros). Veja as assinaturas antes dos corpos (`grep -n '^func'`) e leia por inteiro só o que vai mudar ou servir de modelo.
5. **Antes de mudar** uma função ou uma query, procure quem a usa (`grep -rn <nome> backend frontend`).

## 3. Planejar

1. Monte a lista de passos da task com base nos itens e no "Pronto quando".
2. Se a spec ou o modelo não cobrirem alguma situação necessária, ou se houver contradição entre os documentos, **pare e pergunte** antes de implementar. Registre a decisão no documento correspondente (spec, arquitetura ou modelo) como parte da task. Como você não leu os documentos inteiros, antes de concluir que eles não cobrem o assunto, procure-o neles (`grep -n '<termo>' spec.md modelo-dados.md arquitetura.md`).
3. Anote, para o corpo do PR, o que foi lido e o que ficou de fora, e por quê.
4. Marque a issue como em andamento: `gh issue edit $ARGUMENTS --add-label em-andamento`. Não edite o título nem o corpo da issue, porque a trava trata isso como mudança no plano.

## 4. Implementar

- Escopo estrito: somente o que a task pede. Melhorias percebidas fora do escopo vão para o resumo final como sugestão, não para o código.
- Apenas bibliotecas listadas em `arquitetura.md`. Se precisar de outra, pare e pergunte; se aprovada, registre-a lá com a justificativa.
- Mudanças de esquema somente por migração goose, seguindo `modelo-dados.md`. Se o modelo precisar mudar, atualize `modelo-dados.md` primeiro.
- Aplique as regras de idempotência, concorrência e ACID do `CLAUDE.md` em toda operação que grava dados.
- Faça commits pequenos e coerentes ao longo do trabalho, no padrão Conventional Commits em português.

## 5. Testar e validar

1. Escreva os testes exigidos pelo `CLAUDE.md`: integração no backend (banco PostgreSQL real e próprio para os testes), Playwright no frontend quando a task tiver interface.
2. Rode `make lint` e `make test`. Tudo precisa passar; não desative regras de lint nem pule testes para fazer passar. Ao filtrar a saída (`| tail`, `| grep`), comece o comando com `set -o pipefail`, porque sem ele o `&&` e o código de saída refletem o filtro, e uma falha passa despercebida. Não encadeie lint, testes ou conferências com `git commit`, `git push` ou `gh pr create`: confira o resultado antes de seguir.
3. Percorra cada item de "Pronto quando" e confirme, com evidência (saída de teste, comando executado), que está atendido. Se algum não puder ser verificado (ex.: depende do número real de WhatsApp), anote para o resumo.

## 6. Finalizar com o PR

1. Envie a branch: `git push -u origin <branch>`.
2. Abra o PR para a `main` com `gh pr create`:
   - Título: `T$ARGUMENTS — <título da issue>`.
   - Corpo em português com: `Closes #$ARGUMENTS` na primeira linha, sem fechar nenhuma outra issue, porque a trava confere isso; resumo do que foi feito; checklist do "Pronto quando" com cada item marcado e como foi verificado; decisões tomadas e documentos alterados; o que foi lido e o que ficou de fora; o que não pôde ser verificado; sugestões fora do escopo.
3. Deixe o ambiente de desenvolvimento pronto para o teste manual:
   - Mantenha a branch da task em checkout.
   - Rode `make dev-restart` (exatamente assim, sem variações, porque é o comando liberado nas permissões). Ele para o ambiente que estiver rodando e sobe de novo em segundo plano: o backend roda com `go run` e não recarrega sozinho, então ficaria sem as mudanças da task.
   - Confirme que `http://gc-11.tail9dcef6.ts.net:5173` responde e que a API tem as rotas novas.
   - Se não for possível reiniciar por outro motivo (por exemplo, permissão negada), não contorne: avise o usuário que o `make dev` precisa ser reiniciado.
4. Envie uma notificação push curta com o link do PR e o link de teste `http://gc-11.tail9dcef6.ts.net:5173`, dizendo se os checks do CI ainda vão rodar. Inclua o e-mail do administrador de teste e diga que a senha está em `.dev-credentials`, na raiz do repositório (arquivo local, ignorado pelo git). Nunca coloque a senha na notificação nem na resposta, e nunca exiba o arquivo na saída de um comando (`cat`, `sed`, `Read`), porque ela ficaria no histórico da sessão. O e-mail sai de `grep '^E-mail:' .dev-credentials`, e o login se confere com o comando abaixo, que mostra só o código HTTP. Se o arquivo não existir ou o login falhar (por exemplo, banco de desenvolvimento recriado), crie o administrador de novo com `make dev-create-admin`, gerando a senha sem exibi-la, grave-a no arquivo com permissão 600 e confirme o login da mesma forma.

   ```bash
   python3 -c "import json,re,urllib.request as r; t=open('.dev-credentials').read(); b=json.dumps({'email':re.search(r'E-mail:\s*(\S+)',t)[1],'password':re.search(r'Senha:\s*(\S+)',t)[1]}).encode(); print(r.urlopen(r.Request('http://localhost:8090/api/auth/login',b,{'Content-Type':'application/json'})).status)"
   ```

5. Responda ao usuário com o link do PR, o link de teste, o e-mail de login e o mesmo resumo, de forma curta.

Não faça merge do PR. A revisão e o merge são do usuário.
