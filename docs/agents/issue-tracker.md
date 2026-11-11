# Issues: GitHub

Issues, specs e PRs do xet ficam no GitHub, em `gcaspp-labs/xet`. Use o `gh` em todas as operações; ele descobre o repositório pelo `git remote`.

## Issues

- **Criar**: `gh issue create --title "..." --body "..."`. Para corpo com várias linhas, use heredoc.
- **Ler**: `gh issue view <número> --json number,title,body,labels,comments`.
- **Listar**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'`, com os filtros `--label` e `--state` adequados.
- **Sub-issue de uma spec**: `gh issue create --parent <spec> ...`, ou depois com `gh issue edit <spec> --add-sub-issue <filha>`.
- **Bloqueios**: dependências nativas do GitHub, visíveis na interface. Crie a ligação com `gh issue create --blocked-by <n>,<n> ...` ou `gh issue edit <filha> --add-blocked-by <bloqueadora>`. Um ticket está livre quando todas as bloqueadoras estiverem fechadas.
- **Contar bloqueios abertos**: `gh api repos/gcaspp-labs/xet/issues/<n> --jq .issue_dependencies_summary.blocked_by` (0 quer dizer que pode começar).
- **Comentar**: `gh issue comment <número> --body "..."`.
- **Rótulos**: `gh issue edit <número> --add-label "..."` / `--remove-label "..."`.
- **Fechar**: comente o motivo com `gh issue comment` e depois rode `gh issue close <número>`. Agentes nunca fecham issues com o papel `spec`.

## Pull requests

- **Abrir**: `gh pr create --base main --title "..." --body "..."`, com `Closes #<ticket>` na primeira linha do corpo, e só esse.
- **Ler**: `gh pr view <número> --json number,title,body,state,isDraft,headRefOid,mergeable`, `gh pr diff <número>` e `gh pr checks <número>`.
- **Comentar**: `gh pr comment <número> --body "..."`.
- **Merge**: só pela `merge-gate`. Nenhum agente roda `gh pr merge` direto.

Abra issues só em `gcaspp-labs/xet`. Antes do primeiro `gh issue create` da sessão, confira o destino com `gh repo view --json nameWithOwner`.

O repositório é **público**: issues, comentários e imagens publicadas abrem para qualquer pessoa. Nunca publique dados reais de contatos, órgãos ou mensagens.

## PRs como canal de pedidos

**PRs como canal de pedidos: não.** _(Mude para `sim` se PRs externos passarem a valer como pedidos; a `triage` lê esta marca.)_

O GitHub usa a mesma numeração para issues e PRs, então um `#42` sozinho pode ser qualquer um dos dois: confira com `gh pr view 42` e, se falhar, com `gh issue view 42`.

## Quando uma skill diz "publicar no rastreador"

Crie uma issue no GitHub.

## Quando uma skill diz "buscar o ticket"

Leia como em **Ler**, na seção Issues.
