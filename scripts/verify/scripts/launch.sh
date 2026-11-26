#!/usr/bin/env bash
# Sobe uma instância isolada do xet, com banco vazio e WhatsApp simulado.
# Uso: scripts/verify/scripts/launch.sh
# Termina com o sistema pronto para o Doctor; em qualquer falha, desfaz o que iniciou.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

require_docker

# Outra execução viva nesta cópia do repositório: não duplica nem derruba.
if [ -f "$CURRENT_FILE" ] && [ -d "$RUNS_DIR/$(cat "$CURRENT_FILE")" ]; then
  load_run
  if [ -n "$(run_pids)" ]; then
    fail "a execução $RUN_ID ainda está no ar; rode cleanup.sh antes de iniciar outra."
  fi
fi

for port in $ALL_PORTS; do
  if port_in_use "$port"; then
    fail "a porta $port está ocupada, provavelmente por outra verificação na máquina. Espere ela terminar; nada foi encerrado."
  fi
done

RUN_ID="run-$(date +%Y%m%d-%H%M%S)"
RUN_DIR="$RUNS_DIR/$RUN_ID"
STATE_DIR="$RUN_DIR/state"
BUILD_DIR="$RUN_DIR/build"
LOG_DIR="$RUN_DIR/logs"
EVIDENCE_DIR="$RUN_DIR/evidence"
mkdir -p "$STATE_DIR" "$BUILD_DIR" "$LOG_DIR" "$EVIDENCE_DIR" "$RUN_DIR/data"
chmod 700 "$STATE_DIR"
echo "$RUN_ID" >"$CURRENT_FILE"

launched=false
undo_on_failure() {
  if [ "$launched" = false ]; then
    echo "O launch falhou; desfazendo o que foi iniciado. Logs em $LOG_DIR." >&2
    "$SCRIPTS_DIR/cleanup.sh" "$RUN_ID" >&2 || true
  fi
}
trap undo_on_failure EXIT

# Registra a memória logo no início, para não confundir lentidão com defeito.
echo "== Memória antes de subir"
memory_report | tee "$LOG_DIR/memory-before.txt"
if [ "$(available_mb)" -lt "$LOW_MEMORY_MB" ]; then
  echo "AVISO: menos de $LOW_MEMORY_MB MB disponíveis; espere lentidão e confira vmstat antes de culpar o código."
fi

echo "== Dependências"
if [ ! -x "$ROOT/frontend/node_modules/.bin/vite" ]; then
  echo "frontend/node_modules ausente; rodando npm ci."
  (cd "$ROOT/frontend" && npm ci --no-audit --no-fund) >"$LOG_DIR/npm-ci.log" 2>&1
fi
if ! (cd "$ROOT/frontend" && node -e "process.exit(require('node:fs').existsSync(require('@playwright/test').chromium.executablePath()) ? 0 : 1)"); then
  echo "Chromium do Playwright ausente; instalando."
  (cd "$ROOT/frontend" && npx playwright install chromium) >"$LOG_DIR/playwright-install.log" 2>&1
fi

# As senhas só valem nesta execução: nascem aqui, ficam neste arquivo e morrem com o banco.
ADMIN_EMAIL="admin@verify.test"
ADMIN_PASSWORD="Vf@1$(openssl rand -hex 12)"
USER_PASSWORD="Vf@2$(openssl rand -hex 12)"
(
  umask 077
  printf 'ADMIN_PASSWORD=%s\nUSER_PASSWORD=%s\n' "$ADMIN_PASSWORD" "$USER_PASSWORD" >"$STATE_DIR/secrets.env"
)

echo "== Banco próprio em :$DB_PORT"
POSTGRES_IMAGE="$(sed -n 's/^POSTGRES_IMAGE := //p' "$ROOT/Makefile")"
[ -n "$POSTGRES_IMAGE" ] || fail "POSTGRES_IMAGE não encontrada no Makefile."
# --rm leva junto o volume anônimo; fsync desligado alivia a máquina, e os dados são descartáveis.
DB_COMMON_ARGS=(
  -d --rm --name "xet-verify-db-$RUN_ID"
  --label "xet.verify-app.run=$RUN_ID"
  -e POSTGRES_USER=xet -e POSTGRES_PASSWORD=xet -e POSTGRES_DB=xet
)
DB_IMAGE_ARGS=("$POSTGRES_IMAGE" -c fsync=off -c full_page_writes=off)

# Confere a porta do host de verdade, e não só se o TCP abre: no Docker do snap sem a regra
# de iptables, a conexão é aceita e nada volta. Manda o StartupMessage do Postgres
# (user=xet, database=xet) e espera o primeiro byte da resposta.
db_answers() {
  local port="$1" _
  timeout 3 bash -c '
    exec 3<>"/dev/tcp/127.0.0.1/$1" || exit 1
    printf "\x00\x00\x00\x1f\x00\x03\x00\x00user\x00xet\x00database\x00xet\x00\x00" >&3 || exit 1
    [ "$(dd bs=1 count=1 <&3 2>/dev/null | wc -c)" -ge 1 ]
  ' _ "$port" 2>/dev/null
}

db_answers_within() {
  local port="$1"
  for _ in $(seq 5); do
    db_answers "$port" && return 0
    sleep 1
  done
  return 1
}

# Espera o Postgres aceitar conexão por dentro do contêiner, na porta em que ele escuta lá.
db_ready_inside() {
  local port="$1"
  for _ in $(seq 60); do
    # Pelo TCP interno: durante a inicialização, a imagem só atende pelo socket local.
    if docker exec "$CONTAINER_ID" psql -U xet -d xet -h 127.0.0.1 -p "$port" -Atc 'select 1' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Jeito padrão, igual ao make dev: publica a porta no host. O Docker do snap do Ubuntu, sem
# iptables, aceita a conexão e não encaminha; nesse caso o banco é refeito na rede do host,
# que dispensa a publicação. Fora do Linux a rede do host não vale, mas é justamente onde a
# porta publicada funciona, então este desvio não é usado.
CONTAINER_ID="$(docker run "${DB_COMMON_ARGS[@]}" -p "127.0.0.1:$DB_PORT:5432" "${DB_IMAGE_ARGS[@]}")" \
  || fail "o Docker não subiu o banco."
if ! db_ready_inside 5432; then
  docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  fail "o banco não respondeu em 60 s."
fi
if ! db_answers_within "$DB_PORT"; then
  echo "AVISO: o Docker não encaminha a porta publicada; refazendo o banco na rede do host."
  docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
  CONTAINER_ID="$(docker run "${DB_COMMON_ARGS[@]}" --network host -e PGPORT="$DB_PORT" \
    "${DB_IMAGE_ARGS[@]}" -c port="$DB_PORT")" || fail "o Docker não subiu o banco na rede do host."
  if ! db_ready_inside "$DB_PORT" || ! db_answers_within "$DB_PORT"; then
    docker rm -f "$CONTAINER_ID" >/dev/null 2>&1 || true
    fail "o banco não respondeu em 127.0.0.1:$DB_PORT nem pela rede do host."
  fi
fi
DATABASE_URL="postgres://xet:xet@127.0.0.1:$DB_PORT/xet?sslmode=disable"

cat >"$STATE_DIR/run.env" <<EOF
RUN_ID=$RUN_ID
CONTAINER_ID=$CONTAINER_ID
ADMIN_EMAIL=$ADMIN_EMAIL
COMMIT=$(git -C "$ROOT" rev-parse HEAD)
BRANCH=$(git -C "$ROOT" rev-parse --abbrev-ref HEAD)
CHANGED_FILES=$(git -C "$ROOT" status --porcelain | wc -l)
STARTED_AT="$(date '+%Y-%m-%d %H:%M:%S %z')"
EOF

# Inicia um serviço em sessão própria, com a marca da execução e o PID gravado por ele mesmo.
start_service() {
  local name="$1" dir="$2"
  shift 2
  (
    cd "$dir"
    exec env VERIFY_APP_RUN_ID="$RUN_ID" setsid bash -c 'echo $$ >"$0"; exec "$@"' "$STATE_DIR/$name.pid" "$@"
  ) >"$LOG_DIR/$name.log" 2>&1 </dev/null &
}

# Espera a URL responder, parando antes se o processo já tiver morrido.
wait_for() {
  local name="$1" url="$2" seconds="$3"
  for _ in $(seq "$seconds"); do
    if curl -sf -o /dev/null "$url"; then
      return 0
    fi
    if [ -f "$STATE_DIR/$name.pid" ] && ! service_alive "$name"; then
      tail -n 20 "$LOG_DIR/$name.log" >&2
      fail "$name terminou durante a subida."
    fi
    sleep 1
  done
  tail -n 20 "$LOG_DIR/$name.log" >&2
  fail "$name não respondeu em $url em $seconds s."
}

echo "== API de CNPJ falsa em :$CNPJ_PORT"
start_service cnpj "$ROOT/frontend" env PORT="$CNPJ_PORT" node e2e/fake-cnpj-api.mjs
wait_for cnpj "http://127.0.0.1:$CNPJ_PORT/health" 30

echo "== Backend em :$BACKEND_PORT, com MESSAGING_PROVIDER=fake"
# Binário em vez de go run, para o PID gravado ser o do próprio servidor.
(cd "$ROOT/backend" && go build -o "$BUILD_DIR/server" ./cmd/server)
BACKEND_ENV=(
  HTTP_ADDR="127.0.0.1:$BACKEND_PORT"
  DATABASE_URL="$DATABASE_URL"
  COOKIE_SECURE=false
  MESSAGING_PROVIDER=fake
  CNPJ_API_URL="http://127.0.0.1:$CNPJ_PORT/cnpj"
  STORAGE_DIR="$RUN_DIR/data/media"
)
printf '%s\n' "$ADMIN_PASSWORD" | env "${BACKEND_ENV[@]}" "$BUILD_DIR/server" create-admin \
  -name "Administrador da verificação" -email "$ADMIN_EMAIL" >"$LOG_DIR/create-admin.log" 2>&1
start_service backend "$ROOT/backend" env "${BACKEND_ENV[@]}" "$BUILD_DIR/server"
wait_for backend "$BACKEND_URL/health" 60

echo "== Frontend em :$FRONTEND_PORT"
# Build de produção em pasta própria, como no make test-e2e, sem mexer no dist do checkout.
(cd "$ROOT/frontend" && node_modules/.bin/vite build --outDir "$BUILD_DIR/dist" --emptyOutDir --logLevel warn) \
  >"$LOG_DIR/frontend-build.log" 2>&1
start_service frontend "$ROOT/frontend" env BACKEND_URL="$BACKEND_URL" \
  node_modules/.bin/vite preview --outDir "$BUILD_DIR/dist" --host 127.0.0.1 --port "$FRONTEND_PORT" --strictPort
wait_for frontend "$FRONTEND_URL/health" 60

launched=true
echo
echo "Execução $RUN_ID no ar: $FRONTEND_URL"
echo "Evidências em $EVIDENCE_DIR"
echo "Próximo passo: scripts/verify/scripts/doctor.sh"
