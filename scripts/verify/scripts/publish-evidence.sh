#!/usr/bin/env bash
# Leva as evidências para um PR, sem commit em nenhuma branch.
# Uso: scripts/verify/scripts/publish-evidence.sh <número-do-PR> [id-da-execução]
# Grava imagens e resumos num commit solto, apontado por refs/verify-app/<execução>: o clone normal
# não baixa essa referência e o CI não roda nela. Depois comenta no PR com as imagens.
# O repositório é público: tudo o que for publicado fica aberto a qualquer pessoa. Só publique
# evidência gerada pelas jornadas desta skill, com os dados falsos delas.
# Para apagar depois do merge: git push origin --delete refs/verify-app/<execução>
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

pr="${1:-}"
[ -n "$pr" ] || fail "informe o número do PR."
cd "$ROOT"
load_run "${2:-}"
[ -f "$EVIDENCE_DIR/SUMMARY.md" ] || fail "rode evidence.sh antes de publicar."

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

index="$(mktemp -u)"
body="$(mktemp)"
trap 'rm -f "$index" "$body"' EXIT

ref="refs/verify-app/$RUN_ID"
git_dir="$(git -C "$ROOT" rev-parse --absolute-git-dir)"
# O caminho local da máquina não vai para o repositório.
sed -i "s#$ROOT/##g" "$EVIDENCE_DIR/SUMMARY.md"
commit="$(
  cd "$EVIDENCE_DIR"
  export GIT_DIR="$git_dir" GIT_WORK_TREE=. GIT_INDEX_FILE="$index"
  # Só imagens, vídeos e resumos: o rastro da falha guarda requisições e cookies, e fica local.
  find . -type f \( -name '*.png' -o -name '*.webm' -o -name '*.md' \) -print0 | xargs -0 git add -f --
  git commit-tree "$(git write-tree)" -m "Evidências da verificação $RUN_ID (commit $COMMIT)"
)"
git -C "$ROOT" push --quiet origin "$commit:$ref"

raw_url() {
  echo "https://github.com/$repo/blob/$commit/$1?raw=true"
}

{
  echo "## Evidências da verificação \`$RUN_ID\`"
  echo
  echo "Commit verificado: \`$COMMIT\`. Arquivos: [árvore da evidência](https://github.com/$repo/tree/$commit), [resumo completo]($(raw_url SUMMARY.md))."
  echo
  sed -n '/^## Fluxos do mapa/,/^## Detalhe de cada jornada/p' "$EVIDENCE_DIR/SUMMARY.md" | sed '$d'
  for dir in "$EVIDENCE_DIR"/*/; do
    name="$(basename "$dir")"
    [ -f "$dir/summary.md" ] || continue
    echo
    echo "<details><summary>$(sed -n '1s/^# //p' "$dir/summary.md")</summary>"
    echo
    for image in "$dir"*.png; do
      [ -f "$image" ] || continue
      file="$(basename "$image")"
      echo "**$file**"
      echo
      echo "![$file]($(raw_url "$name/$file"))"
      echo
    done
    echo "</details>"
  done
  echo
  echo "Para apagar estas evidências: \`git push origin --delete $ref\`"
} >"$body"

gh pr comment "$pr" --repo "$repo" --body-file "$body"
echo "Referência: $ref ($commit)"
