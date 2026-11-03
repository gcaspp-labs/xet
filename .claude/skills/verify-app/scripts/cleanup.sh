#!/usr/bin/env bash
# Encerra só o que a execução iniciou e preserva as evidências.
# Uso: .claude/skills/verify-app/scripts/cleanup.sh [id-da-execução]
# Pode ser repetido sem efeito. Saída 1 se sobrar porta, processo ou contêiner da execução.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

load_run "${1:-}"

report="$LOG_DIR/cleanup.txt"
: >"$report"
say() {
  echo "$*" | tee -a "$report"
}

# 1. Processos marcados com esta execução, nunca pelo nome: backend, frontend e navegador antes do banco.
pids="$(run_pids)"
if [ -n "$pids" ]; then
  # shellcheck disable=SC2086
  kill -TERM $pids 2>/dev/null
  for _ in $(seq 20); do
    [ -z "$(run_pids)" ] && break
    sleep 1
  done
  remaining="$(run_pids)"
  if [ -n "$remaining" ]; then
    # shellcheck disable=SC2086
    kill -KILL $remaining 2>/dev/null
    sleep 1
  fi
fi

# 2. O contêiner registrado, conferindo o rótulo antes de parar.
if [ -n "${CONTAINER_ID:-}" ]; then
  label="$(docker inspect -f '{{index .Config.Labels "xet.verify-app.run"}}' "$CONTAINER_ID" 2>/dev/null)"
  if [ "$label" = "$RUN_ID" ]; then
    docker logs "$CONTAINER_ID" >"$LOG_DIR/db.log" 2>&1
    docker stop -t 10 "$CONTAINER_ID" >/dev/null
  fi
fi

# 3. O que é da execução e não é evidência: senhas, binário, build e anexos do banco descartado.
rm -f "$STATE_DIR/secrets.env"
rm -rf "$BUILD_DIR" "$RUN_DIR/data"

# 4. Confere o resultado, em vez de presumir.
problems=0
left="$(run_pids | tr '\n' ' ')"
if [ -n "${left// /}" ]; then
  say "FALHA: processos da execução ainda vivos: $left"
  problems=$((problems + 1))
else
  say "Nenhum processo da execução ficou para trás."
fi
if ! containers="$(docker ps -aq --filter "label=xet.verify-app.run=$RUN_ID" 2>&1)"; then
  say "FALHA: o Docker não respondeu, e não deu para conferir o contêiner: $containers"
  problems=$((problems + 1))
elif [ -n "$containers" ]; then
  say "FALHA: contêiner da execução ainda existe: $containers"
  problems=$((problems + 1))
else
  say "Nenhum contêiner da execução ficou para trás."
fi
busy=""
for port in $ALL_PORTS; do
  if port_in_use "$port"; then
    busy="$busy $port"
  fi
done
if [ -n "$busy" ]; then
  say "FALHA: portas ainda ocupadas:$busy"
  problems=$((problems + 1))
else
  say "Portas $ALL_PORTS livres."
fi
files="$(find "$EVIDENCE_DIR" -type f | wc -l)"
say "Evidências preservadas: $files arquivo(s) em $EVIDENCE_DIR."

if [ "$problems" -gt 0 ]; then
  exit 1
fi
