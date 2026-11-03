#!/usr/bin/env bash
# Monta o resumo da execução: o que foi provado, o que falhou e o que ficou de fora.
# Uso: .claude/skills/verify-app/scripts/evidence.sh [id-da-execução]
# Pode rodar antes ou depois do Cleanup. Escreve evidence/SUMMARY.md e o imprime.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

load_run "${1:-}"
require_started
summary="$EVIDENCE_DIR/SUMMARY.md"

{
  echo "# Verificação $RUN_ID"
  echo
  echo "- Commit: \`$COMMIT\` (branch \`$BRANCH\`)"
  echo "- Arquivos sem commit na subida: $CHANGED_FILES"
  echo "- Início: $STARTED_AT"
  echo "- Resumo gerado em: $(date '+%Y-%m-%d %H:%M:%S %z')"
  echo "- WhatsApp: simulado pelo adaptador falso; nada aqui prova o WhatsApp real."
  echo
  echo "## Fluxos do mapa"
  echo
  echo "| Fluxo | Resultado | Passos | Evidência |"
  echo "| --- | --- | --- | --- |"
  for feature in "$SKILL_DIR"/features/*.md; do
    name="$(basename "$feature" .md)"
    [ "$name" != README ] || continue
    if [ -f "$EVIDENCE_DIR/$name/summary.md" ]; then
      result="$(sed -n '1s/^# Jornada [^:]*: //p' "$EVIDENCE_DIR/$name/summary.md")"
      steps="$(grep -c '^[0-9]*\. ' "$EVIDENCE_DIR/$name/summary.md" || true)"
      echo "| $name | $result | $steps | \`evidence/$name/\` |"
    else
      echo "| $name | NÃO PROVADO: não percorrido nesta execução | 0 | |"
    fi
  done

  # Jornadas avulsas, fora do mapa.
  for dir in "$EVIDENCE_DIR"/*/; do
    [ -f "$dir/summary.md" ] || continue
    name="$(basename "$dir")"
    [ ! -f "$SKILL_DIR/features/$name.md" ] || continue
    result="$(sed -n '1s/^# Jornada [^:]*: //p' "$dir/summary.md")"
    echo "| $name (fora do mapa) | $result | $(grep -c '^[0-9]*\. ' "$dir/summary.md" || true) | \`evidence/$name/\` |"
  done

  echo
  echo "## Fica para a verificação manual ou sem cobertura nestas jornadas"
  echo
  for feature in "$SKILL_DIR"/features/*.md; do
    name="$(basename "$feature" .md)"
    [ "$name" != README ] || continue
    grep -E '^- \[(manual|não coberto)\]' "$feature" | sed "s/^- /- $name: /" || true
  done

  echo
  echo "## Sinais do backend"
  echo
  if [ -f "$LOG_DIR/backend.log" ]; then
    errors="$(grep -c '"level":"ERROR"' "$LOG_DIR/backend.log" || true)"
    cancelled="$(grep '"level":"ERROR"' "$LOG_DIR/backend.log" | grep -c 'context canceled' || true)"
    echo "- Linhas de erro no log do backend: $errors, sendo $cancelled de requisição cancelada pelo cliente."
    if [ "$errors" != "$cancelled" ]; then
      echo "- Outros erros, que precisam de explicação:"
      echo
      echo '```text'
      grep '"level":"ERROR"' "$LOG_DIR/backend.log" | grep -v 'context canceled' | head -n 10 | cut -c1-300
      echo '```'
      echo
    fi
    echo "- Log: \`$LOG_DIR/backend.log\`"
  else
    echo "- Log do backend não encontrado."
  fi
  if [ -f "$LOG_DIR/cleanup.txt" ]; then
    echo
    echo "## Cleanup"
    echo
    sed 's/^/- /' "$LOG_DIR/cleanup.txt"
  fi
  echo
  echo "## Detalhe de cada jornada"
  for dir in "$EVIDENCE_DIR"/*/; do
    if [ -f "$dir/summary.md" ]; then
      echo
      sed 's/^#/##/' "$dir/summary.md"
    fi
  done
} >"$summary"

cat "$summary"
echo
echo "Resumo em $summary"
