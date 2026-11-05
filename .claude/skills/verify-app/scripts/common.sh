# Definições comuns dos scripts da skill verify-app. Carregado com `source`, não é executado.

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(dirname "$SCRIPTS_DIR")"
ROOT="$(cd "$SKILL_DIR/../../.." && pwd)"

# Fica fora de .claude/skills, que pode ser protegido contra escrita, e é ignorado pelo git.
WORK_DIR="$ROOT/.verify-app"
RUNS_DIR="$WORK_DIR/runs"
CURRENT_FILE="$WORK_DIR/current"

# Portas próprias: um 2 na frente das portas do make dev. Fixas de propósito: como não há memória
# para duas instâncias ao mesmo tempo, a porta ocupada também impede a segunda execução na máquina.
DB_PORT=25440
BACKEND_PORT=28090
CNPJ_PORT=28091
FRONTEND_PORT=25173
ALL_PORTS="$DB_PORT $BACKEND_PORT $CNPJ_PORT $FRONTEND_PORT"

BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"

# Abaixo disso, tempos esgotados tendem a vir da máquina, não do código.
LOW_MEMORY_MB=1500

fail() {
  echo "ERRO: $*" >&2
  exit 1
}

# Com NoNewPrivs (shell de agente), o /snap/bin/docker falha no snap-confine. Como no Makefile, chama
# o binário do snap direto, pelo socket do Docker. O caminho vale só para a instância desta skill.
SNAP_DOCKER_BIN=/snap/docker/current/bin
if [ -x "$SNAP_DOCKER_BIN/docker" ] && grep -q '^NoNewPrivs:[[:space:]]*1' /proc/self/status; then
  export PATH="$SNAP_DOCKER_BIN:$PATH"
  export DOCKER_HOST="${DOCKER_HOST:-unix:///var/run/docker.sock}"
fi

# Se o Docker não responder mesmo assim, a verificação para aqui.
require_docker() {
  local output
  if ! output="$(docker ps --format '{{.ID}}' 2>&1)"; then
    echo "ERRO: o Docker não responde neste shell. Avise o usuário e pare:" >&2
    echo "$output" | head -n 3 >&2
    exit 3
  fi
}

port_in_use() {
  [ -n "$(ss -ltnH "sport = :$1" 2>/dev/null)" ]
}

# Carrega uma execução: a indicada ou a atual, a última criada pelo launch.
load_run() {
  RUN_ID="${1:-}"
  if [ -z "$RUN_ID" ]; then
    [ -f "$CURRENT_FILE" ] || fail "nenhuma execução encontrada; rode launch.sh."
    RUN_ID="$(cat "$CURRENT_FILE")"
  fi
  RUN_DIR="$RUNS_DIR/$RUN_ID"
  [ -d "$RUN_DIR" ] || fail "execução $RUN_ID não existe em $RUNS_DIR."
  STATE_DIR="$RUN_DIR/state"
  BUILD_DIR="$RUN_DIR/build"
  LOG_DIR="$RUN_DIR/logs"
  EVIDENCE_DIR="$RUN_DIR/evidence"
  if [ -f "$STATE_DIR/run.env" ]; then
    # shellcheck disable=SC1091
    source "$STATE_DIR/run.env"
  fi
}

# Para quem só faz sentido depois de o banco da execução ter subido.
require_started() {
  [ -f "$STATE_DIR/run.env" ] || fail "a execução $RUN_ID não chegou a subir; rode launch.sh."
}

# Processos da execução, achados pela marca herdada no ambiente, e nunca pelo nome: vale também para
# os filhos e não pega nada que a execução não iniciou. O Chromium sobrescreve o próprio ambiente, então
# a marca dele vem num argumento, e os filhos dele são achados pelo grupo do processo principal.
run_pids() {
  local env_marker="VERIFY_APP_RUN_ID=$RUN_ID" arg_marker="--verify-app-run=$RUN_ID" dir pid
  for dir in /proc/[0-9]*; do
    pid="${dir#/proc/}"
    if grep -qzx -- "$env_marker" "$dir/environ" 2>/dev/null; then
      echo "$pid"
    elif grep -qzF -- "$arg_marker" "$dir/cmdline" 2>/dev/null; then
      echo "$pid"
      pgrep -g "$pid" || true
    fi
  done | sort -un
}

service_alive() {
  local pid
  pid="$(cat "$STATE_DIR/$1.pid" 2>/dev/null)" || return 1
  grep -qzx -- "VERIFY_APP_RUN_ID=$RUN_ID" "/proc/$pid/environ" 2>/dev/null
}

memory_report() {
  free -m
  echo
  vmstat 1 2
}

# LC_ALL=C porque o rótulo da linha muda com o idioma do sistema.
available_mb() {
  LC_ALL=C free -m | awk '/^Mem:/ {print $NF}'
}
