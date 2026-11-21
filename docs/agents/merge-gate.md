# Trava do merge

O que a `merge-gate` confere antes de um merge sem a pessoa, e como classificar o risco de cada ticket. Na dúvida, a trava chama a pessoa.

O script da `merge-gate` lê os **blocos de código com nome** deste arquivo (`checks`, `sensitive-paths`, `auto-merge-risk`, `command-mode-risk`, `command-mode-locked-paths`, `marker`, `merge-method`). Edite o conteúdo dos blocos, mas mantenha os nomes.

## Checks obrigatórios

Os nomes exatos dos jobs do CI (`.github/workflows/ci.yml`) que precisam estar verdes no último commit do PR, um por linha:

```checks
Lint
Código gerado
Testes do backend
Testes ponta a ponta
```

## Áreas sensíveis

Um PR que toca qualquer um destes caminhos nunca entra sem a pessoa, a não ser com o modo comando ligado (veja abaixo). Uma expressão regular por linha, comparada com o caminho de cada arquivo do diff a partir da raiz:

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
risk:medium
```

Os riscos que entram sem a pessoa **só enquanto o modo comando estiver ligado**, um rótulo por linha. O modo comando é uma janela com fim que a pessoa entrega ao Chief (ex.: até 06:00); passou do horário, desliga sozinho, e a trava não aceita janela com mais de 24h. Com a janela aberta, as áreas sensíveis também deixam de barrar, em qualquer risco, menos as travadas (bloco abaixo). As outras checagens continuam valendo: CI verde, parecer `approve` no último commit, nenhum teste removido, um único ticket. Fora da janela, nada muda. Liga e desliga na raiz do repo com o `command-mode.sh` da skill `merge-gate` (`on 06:00`, `status`, `off`), só quando a pessoa pedir. Quando o modo comando é o que libera o merge, a trava imprime uma linha `COMMAND MODE:` para o risco e outra com as áreas sensíveis liberadas; todas vão no comentário do PR.

```command-mode-risk
risk:high
```

As áreas que o modo comando **nunca** libera, uma expressão regular por linha: as regras dos agentes e da trava, e o CI. Um PR que toca uma delas sempre espera a pessoa, com a janela aberta ou não. Sem este bloco (ou vazio), a trava usa estes mesmos dois caminhos.

```command-mode-locked-paths
^docs/agents/
^\.github/
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
