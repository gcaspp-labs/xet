#!/usr/bin/env bash
# Trava do merge automático. Sem certeza, chama a pessoa.
#
# Uso: merge-gate.sh <PR> [--merge]
# Saída: 0 liberado (ou merge feito), 10 chamar a pessoa, 2 erro ao consultar.
set -uo pipefail

readonly required_checks=("Lint" "Código gerado" "Testes do backend" "Testes ponta a ponta")
# Migrações, login e permissões, Whatsmeow, deploy, CI e as regras dos agentes.
readonly sensitive='^(backend/db/migrations/|backend/internal/core/auth/|backend/internal/core/users/|backend/internal/helpdesk/access\.go$|backend/internal/helpdesk/messaging/|deploy/|\.github/|\.claude/|CLAUDE\.md$|Makefile$|frontend/playwright\.config\.ts$)'
readonly marker='PARECER-DO-REVISOR'

pr="${1:-}"
action="${2:-}"
if [[ ! "$pr" =~ ^[0-9]+$ ]] || [[ -n "$action" && "$action" != "--merge" ]]; then
  echo "Uso: merge-gate.sh <PR> [--merge]" >&2
  exit 2
fi

reasons=()
refuse() { reasons+=("$1"); }
fail() {
  echo "ERRO: $1" >&2
  exit 2
}

fields=$(gh pr view "$pr" --json state,isDraft,baseRefName,mergeable,headRefOid,title \
  --jq '[.state, .isDraft, .baseRefName, .mergeable, .headRefOid, .title] | @tsv') ||
  fail "não foi possível ler o PR $pr"
IFS=$'\t' read -r state draft base mergeable head title <<<"$fields"
[[ -n "${head:-}" ]] || fail "PR $pr sem commit"

[[ "$state" == "OPEN" ]] || refuse "PR não está aberto ($state)"
[[ "$draft" == "false" ]] || refuse "PR em rascunho"
[[ "$base" == "main" ]] || refuse "base não é a main ($base)"
[[ "$mergeable" == "MERGEABLE" ]] || refuse "GitHub não confirma o merge ($mergeable)"

# A classificação vem da issue da task, liberada pelo merge do PR de documentação.
# Editar o título ou o corpo da issue depois desse merge conta como mudança sem aprovação.
task=$(sed -nE 's/^T([0-9]+) — .*/\1/p' <<<"$title")
if [[ -z "$task" ]]; then
  refuse "PR não é de task: o título não começa com 'TNN — '"
else
  issue_query() {
    gh api graphql -F owner='{owner}' -F name='{repo}' -F number="$task" \
      -f query='query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          issue(number: $number) { state lastEditedAt body labels(first: 50) { nodes { name } } }
        }
      }' --jq "$1"
  }
  issue=$(issue_query '.data.repository.issue | [.state, ([.labels.nodes[].name] | join(",")), (.lastEditedAt // "-")] | @tsv') ||
    fail "não foi possível ler a issue $task"
  IFS=$'\t' read -r issue_state issue_labels issue_edited <<<"$issue"
  issue_body=$(issue_query '.data.repository.issue.body' | tr -d '\r') ||
    fail "não foi possível ler a issue $task"

  [[ ",$issue_labels," == *",task,"* ]] || refuse "issue #$task não tem o rótulo 'task'"
  [[ "$issue_state" == "OPEN" ]] || refuse "issue #$task não está aberta ($issue_state)"
  grep -qE '^\*\*Verificação:\*\* automática\s*$' <<<"$issue_body" ||
    refuse "T$task não está marcada como '**Verificação:** automática'"

  plan=$(sed -nE 's/^\*\*Plano:\*\* #([0-9]+)[[:space:]]*$/\1/p' <<<"$issue_body" | head -1)
  if [[ -z "$plan" ]]; then
    refuse "issue #$task sem '**Plano:** #PR'"
  else
    plan_fields=$(gh pr view "$plan" --json state,mergedAt --jq '[.state, (.mergedAt // "-")] | @tsv') ||
      fail "não foi possível ler o PR de plano #$plan"
    IFS=$'\t' read -r plan_state plan_merged <<<"$plan_fields"
    plan_body=$(gh pr view "$plan" --json body --jq '.body' | tr -d '\r') ||
      fail "não foi possível ler o PR de plano #$plan"
    [[ "$plan_state" == "MERGED" ]] || refuse "PR de plano #$plan sem merge ($plan_state)"
    grep -qE "^Tasks: .*#$task([^0-9]|\$)" <<<"$plan_body" || refuse "PR de plano #$plan não cita a issue #$task"
    # Datas em UTC e no mesmo formato: a comparação de texto respeita a ordem.
    if [[ "$plan_state" == "MERGED" && "$issue_edited" != "-" && "$issue_edited" > "$plan_merged" ]]; then
      refuse "issue #$task editada depois do merge do plano #$plan"
    fi
  fi

  closes=$(gh pr view "$pr" --json closingIssuesReferences --jq '[.closingIssuesReferences[].number] | map(tostring) | join(",")') ||
    fail "não foi possível ler as issues que o PR fecha"
  [[ "$closes" == "$task" ]] || refuse "PR precisa fechar só a issue #$task; fecha: ${closes:-nenhuma}"
fi

for check in "${required_checks[@]}"; do
  result=$(gh api "repos/{owner}/{repo}/commits/$head/check-runs?per_page=100" \
    --jq ".check_runs | map(select(.name == \"$check\")) | sort_by(.started_at) | last | .conclusion // \"ausente\"") ||
    fail "não foi possível ler os checks"
  [[ "$result" == "success" ]] || refuse "check '$check': $result"
done

behind=$(gh api "repos/{owner}/{repo}/compare/main...$head" --jq '.behind_by') ||
  fail "não foi possível comparar com a main"
[[ "$behind" == "0" ]] || refuse "branch está $behind commit(s) atrás da main; o CI não testou o resultado do merge"

files=$(gh api --paginate "repos/{owner}/{repo}/pulls/$pr/files" \
  --jq '.[] | [.status, .filename, (.previous_filename // "")] | @tsv') ||
  fail "não foi possível ler os arquivos do PR"
[[ -n "$files" ]] || refuse "PR sem arquivos"
while IFS=$'\t' read -r file_status file previous; do
  [[ -n "${file:-}" ]] || continue
  for path in "$file" "$previous"; do
    [[ -n "$path" && "$path" =~ $sensitive ]] && refuse "área sensível: $path"
  done
  if [[ "$file_status" == "removed" && "$file" =~ (_test\.go|\.spec\.ts)$ ]]; then
    refuse "remove teste: $file"
  fi
done <<<"$files"

opinion=$(gh api --paginate "repos/{owner}/{repo}/issues/$pr/comments" --jq '.[].body' | tr -d '\r' |
  awk -v marker="$marker" '
    $0 == marker { block = ""; collecting = 1; next }
    collecting && /^```/ { collecting = 0; next }
    collecting { block = block $0 "\n" }
    END { printf "%s", block }')
field() { sed -nE "s/^$1:[[:space:]]*(.*[^[:space:]])[[:space:]]*$/\1/p" <<<"$opinion" | head -1; }
if [[ -z "$opinion" ]]; then
  refuse "sem parecer do Revisor ($marker)"
else
  [[ "$(field commit)" == "$head" ]] || refuse "parecer é de outro commit: $(field commit)"
  [[ "$(field resultado)" == "aprovado" ]] || refuse "resultado do parecer: $(field resultado)"
  [[ "$(field pronto-quando)" == "todos provados" ]] || refuse "'Pronto quando' sem prova completa: $(field pronto-quando)"
  [[ "$(field nao-provado)" == "nenhum" ]] || refuse "não provado: $(field nao-provado)"
  [[ "$(field evidencia)" =~ ^https:// ]] || refuse "parecer sem link de evidência"
fi

if ((${#reasons[@]} > 0)); then
  echo "CHAMAR A PESSOA: PR $pr em $head"
  printf -- '- %s\n' "${reasons[@]}"
  exit 10
fi

echo "LIBERADO: PR $pr em $head"
if [[ "$action" == "--merge" ]]; then
  gh pr merge "$pr" --merge --match-head-commit "$head" || fail "merge recusado"
  echo "MERGE FEITO: PR $pr"
fi
