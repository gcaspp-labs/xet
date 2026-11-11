#!/usr/bin/env bash
# Conduz jornadas, uma de cada vez, com um navegador só.
# Uso: scripts/verify/scripts/drive.sh [--video] <jornada|caminho/arquivo.mjs|all> ...
# Exemplos: drive.sh receive-and-assign reply
#           drive.sh --video close
#           drive.sh all
# Saída 0: todas passaram. Saída 1: alguma falhou; o motivo está na evidência da jornada.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

video=0
if [ "${1:-}" = "--video" ]; then
  video=1
  shift
fi
[ $# -gt 0 ] || fail "informe ao menos uma jornada ou all."

load_run
service_alive backend && service_alive frontend ||
  fail "a execução $RUN_ID não está no ar; rode launch.sh e doctor.sh."

journeys=()
for arg in "$@"; do
  if [ "$arg" = all ]; then
    for file in "$SKILL_DIR"/journeys/*.mjs; do
      journeys+=("$file")
    done
  elif [ -f "$arg" ]; then
    journeys+=("$(realpath "$arg")")
  elif [ -f "$SKILL_DIR/journeys/$arg.mjs" ]; then
    journeys+=("$SKILL_DIR/journeys/$arg.mjs")
  else
    fail "jornada não encontrada: $arg. Disponíveis: $(ls "$SKILL_DIR/journeys" | sed 's/\.mjs$//' | tr '\n' ' ')"
  fi
done

failed=0
for file in "${journeys[@]}"; do
  echo "== Jornada $(basename "$file" .mjs)"
  # As senhas só chegam ao processo da jornada, e nunca à saída.
  (
    set -a
    # shellcheck disable=SC1091
    source "$STATE_DIR/secrets.env"
    set +a
    export VERIFY_APP_RUN_ID="$RUN_ID" VERIFY_APP_ROOT="$ROOT" VERIFY_APP_EVIDENCE_DIR="$EVIDENCE_DIR" \
      VERIFY_APP_BASE_URL="$FRONTEND_URL" VERIFY_APP_CONTAINER="$CONTAINER_ID" VERIFY_APP_ADMIN_EMAIL="$ADMIN_EMAIL" \
      VERIFY_APP_COMMIT="$COMMIT" VERIFY_APP_VIDEO="$video" VERIFY_APP_LIB="$SCRIPTS_DIR/journey-lib.mjs"
    # Limite para não deixar uma jornada travada segurando a máquina.
    timeout --kill-after=15 600 node "$file"
  )
  code=$?
  if [ "$code" -ne 0 ]; then
    failed=$((failed + 1))
    echo "Jornada $(basename "$file" .mjs) FALHOU (saída $code)."
  fi
done

echo
if [ "$failed" -gt 0 ]; then
  echo "$failed de ${#journeys[@]} jornada(s) falharam. Evidências em $EVIDENCE_DIR."
  exit 1
fi
echo "${#journeys[@]} jornada(s) passaram. Evidências em $EVIDENCE_DIR."
