#!/usr/bin/env bash
# Confere, sem alterar nada, se a instância vale a pena ser conduzida.
# Uso: scripts/verify/scripts/doctor.sh
# Saída 0: tudo certo. Saída 1: não conduza; corrija ou recomece.
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

load_run "${1:-}"
require_started
problems=0

check() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "ok     $label"
  else
    echo "FALHA  $label"
    problems=$((problems + 1))
  fi
}

http_is() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$2")" = "$1" ]
}

sql() {
  docker exec -e PGOPTIONS='-c default_transaction_read_only=on' "$CONTAINER_ID" psql -U xet -d xet -Atc "$1"
}

fake_provider_active() {
  local pid
  pid="$(cat "$STATE_DIR/backend.pid")"
  grep -qzx 'MESSAGING_PROVIDER=fake' "/proc/$pid/environ" &&
    grep -q 'using the fake messaging provider' "$LOG_DIR/backend.log"
}

# As rotas do celular simulado só são montadas pelo adaptador falso: aqui, o método errado dá 405.
test_routes_mounted() {
  http_is 405 "$FRONTEND_URL/api/test/messaging/sectors/0/qr"
}

own_database() {
  local pid
  pid="$(cat "$STATE_DIR/backend.pid")"
  grep -qzx "DATABASE_URL=postgres://xet:xet@127.0.0.1:$DB_PORT/xet?sslmode=disable" "/proc/$pid/environ"
}

admin_exists() {
  [ "$(sql "select count(*) from users where email = '$ADMIN_EMAIL' and role = 'admin' and active")" = 1 ]
}

migrated() {
  [ "$(sql 'select count(*) > 1 from goose_db_version')" = t ]
}

chromium_installed() {
  (cd "$ROOT/frontend" && node -e "process.exit(require('node:fs').existsSync(require('@playwright/test').chromium.executablePath()) ? 0 : 1)")
}

echo "Execução $RUN_ID (commit ${COMMIT:0:12}, branch $BRANCH, $CHANGED_FILES arquivo(s) alterado(s) na subida)"
check "banco próprio responde em :$DB_PORT" sql 'select 1'
check "migrações aplicadas" migrated
check "administrador da execução existe" admin_exists
check "API de CNPJ falsa no ar" http_is 200 "http://127.0.0.1:$CNPJ_PORT/health"
check "backend no ar" service_alive backend
check "backend responde em /health" http_is 200 "$BACKEND_URL/health"
check "backend usa o banco próprio" own_database
check "WhatsApp simulado: MESSAGING_PROVIDER=fake" fake_provider_active
check "rotas do celular simulado montadas" test_routes_mounted
check "frontend no ar" service_alive frontend
check "frontend serve a aplicação" http_is 200 "$FRONTEND_URL/"
check "proxy do frontend chega ao backend" http_is 200 "$FRONTEND_URL/health"
check "API exige login pelo proxy" http_is 401 "$FRONTEND_URL/api/auth/me"
check "Chromium do Playwright instalado" chromium_installed

# O que foi construído precisa ser o que está sendo verificado.
current_commit="$(git -C "$ROOT" rev-parse HEAD)"
if [ "$current_commit" != "$COMMIT" ]; then
  echo "AVISO  o checkout está em ${current_commit:0:12}, mas a instância foi construída em ${COMMIT:0:12}: recomece para verificar o commit atual."
fi
if [ "$CHANGED_FILES" != 0 ]; then
  echo "AVISO  havia $CHANGED_FILES arquivo(s) sem commit na subida: a evidência não corresponde só ao commit."
fi

available="$(available_mb)"
if [ "$available" -lt "$LOW_MEMORY_MB" ]; then
  echo "AVISO  memória disponível: $available MB, abaixo de $LOW_MEMORY_MB MB. Espere lentidão."
else
  echo "ok     memória disponível: $available MB"
fi

if [ "$problems" -gt 0 ]; then
  echo "$problems problema(s). Não conduza esta instância; veja os logs em $LOG_DIR."
  exit 1
fi
echo "Instância pronta para conduzir."
