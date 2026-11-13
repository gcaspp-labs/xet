# Rótulos

As skills falam em **papéis**. Este arquivo liga cada papel ao rótulo do GitHub do xet. Quando uma skill disser "aplique o papel `ready-for-agent`", use o rótulo da segunda coluna.

## Categoria (um por issue)

| Papel | Rótulo no xet | Significado |
|---|---|---|
| `bug` | `bug` | algo está quebrado |
| `enhancement` | `enhancement` | funcionalidade nova ou melhoria |

## Estado da triagem (um por issue)

| Papel | Rótulo no xet | Significado |
|---|---|---|
| `needs-triage` | `needs-triage` | aguardando avaliação; é como a `journal` registra as anotações |
| `needs-info` | `needs-info` | aguardando mais informação de quem relatou |
| `ready-for-agent` | `ready-for-agent` | especificado por completo, pronto para um agente |
| `ready-for-human` | `ready-for-human` | precisa ser implementado por uma pessoa |
| `wontfix` | `wontfix` | não será feito |

As issues fechadas até a #103 com `ready-for-agent` eram tasks do fluxo antigo (rótulo `task`, renomeado).

## Tipo

| Papel | Rótulo no xet | Significado |
|---|---|---|
| `spec` | `spec` | issue mãe de uma spec. Os tickets dela são as sub-issues. **Só a pessoa fecha.** |

## Andamento

| Papel | Rótulo no xet | Significado |
|---|---|---|
| `in-progress` | `in-progress` | um agente está implementando o ticket; nenhum outro deve pegá-lo |
| `to-docs` | `to-docs` | todos os tickets da spec entraram; as regras aguardam documentação em `docs/features/` |

## Risco (um por ticket)

| Papel | Rótulo no xet | Significado |
|---|---|---|
| `risk:low` | `risk:low` | pode entrar sem a pessoa quando a trava passa |
| `risk:medium` | `risk:medium` | pode entrar sem a pessoa quando a trava passa (o Chief of Staff decide) |
| `risk:high` | `risk:high` | a pessoa aprova o merge; revisão aprofundada |

Substitui o antigo campo `**Verificação:**`: `automática` equivale a `risk:low`, e `humana` a `risk:high`; `risk:medium` entra pela trava. Como classificar o risco: ver `merge-gate.md`.

## Outros

`documentation`, `accessibility`, `duplicate`, `invalid`, `question`, `good first issue` e `help wanted` são os rótulos padrão do GitHub. Nenhuma skill depende deles.
