#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
POKEMON_WORLD_DIR="/Users/yilin/Developer/ReScienceLab/pokemon-world"

if [ ! -d "$POKEMON_WORLD_DIR" ]; then
  echo "[autoresearch] Missing pokemon-world repo at $POKEMON_WORLD_DIR" >&2
  exit 1
fi

now_ms() {
  python - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

run_step() {
  local var_name="$1"
  shift
  local start_ms end_ms
  start_ms=$(now_ms)
  "$@"
  end_ms=$(now_ms)
  local duration=$((end_ms - start_ms))
  printf -v "$var_name" '%s' "$duration"
}

start_total_ms=$(now_ms)

echo "[autoresearch] npm run build"
run_step dap_build_ms npm run build

echo "[autoresearch] node --test test/*.test.mjs"
run_step dap_tests_ms node --test test/*.test.mjs

echo "[autoresearch] pokemon-world: node --check server.mjs"
run_step pokemon_check_ms bash -c "cd '$POKEMON_WORLD_DIR' && node --check server.mjs"

end_total_ms=$(now_ms)
total_ms=$((end_total_ms - start_total_ms))

echo "METRIC dap_build_ms=$dap_build_ms"
echo "METRIC dap_tests_ms=$dap_tests_ms"
echo "METRIC pokemon_check_ms=$pokemon_check_ms"
echo "METRIC total_ms=$total_ms"
