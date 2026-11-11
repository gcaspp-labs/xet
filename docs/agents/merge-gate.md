# Trava do merge

O que a `merge-gate` confere antes de um merge sem a pessoa, e como classificar o risco de cada ticket. Na dúvida, a trava chama a pessoa.

O script da `merge-gate` lê os **blocos de código com nome** deste arquivo (`checks`, `sensitive-paths`, `auto-merge-risk`, `marker`, `merge-method`). Edite o conteúdo dos blocos, mas mantenha os nomes.

## Checks obrigatórios

Os nomes exatos dos jobs do CI (`.github/workflows/ci.yml`) que precisam estar verdes no último commit do PR, um por linha:

```checks
Lint
Código gerado
Testes do backend
Testes ponta a ponta
```

## Áreas sensíveis

Um PR que toca qualquer um destes caminhos nunca entra sem a pessoa. Uma expressão regular por linha, comparada com o caminho de cada arquivo do diff a partir da raiz:

```sensitive-paths
^backend/db/migrations/
^backend/internal/core/auth/
^backend/internal/core/users/
^backend/internal/helpdesk/access\.go$
^backend/internal/helpdesk/messaging/
^deploy/
^\.github/
^\.claude/
^scripts/verify/
^AGENTS\.md$
^CLAUDE\.md$
^docs/agents/
^Makefile$
^frontend/playwright\.config\.ts$
```

São as migrações, o login e as permissões, a integração com o WhatsApp (Whatsmeow), a implantação, o CI, as regras dos agentes, a configuração dos testes e o kit de verificação (`scripts/verify/`), para uma jornada não ser enfraquecida no mesmo PR que ela prova.

## Regra de risco

O papel de risco é aplicado ao ticket quando ele é criado, antes da implementação. A trava confere os caminhos de novo no diff real.

| Risco | Quando |
|---|---|
| `risk:high` | toca uma área sensível; muda o esquema do banco, a autenticação, as permissões por setor, a implantação, o CI ou as regras dos agentes; depende do WhatsApp real ou de outro serviço externo real; mexe numa regra crítica (assumir chamado com concorrência, só o responsável responde, um chamado aberto por contato e setor, idempotência de mensagens) |
| `risk:medium` | muda o comportamento de uma funcionalidade (uma regra de `docs/features/` ou de `spec.md` muda ou é acrescentada) |
| `risk:low` | documentação, textos, estilos, ou uma mudança só aditiva que não toca nenhuma regra existente |

Na dúvida entre dois níveis, use o maior.

## Merge sem a pessoa

Os riscos que podem entrar sem a pessoa quando a trava passa, um rótulo por linha. Qualquer outro precisa da aprovação da pessoa.

```auto-merge-risk
risk:low
```

Método de merge (`merge`, `squash` ou `rebase`):

```merge-method
merge
```

## Parecer do revisor

A `code-review` publica no PR um comentário que começa com este marcador, seguido das linhas `Verdict: approve | request-changes`, `Commit: <sha>` e `Round: <n>/2`. A trava só aceita um parecer `approve` sobre o último commit do PR.

```marker
<!-- REVIEWER-VERDICT -->
```
