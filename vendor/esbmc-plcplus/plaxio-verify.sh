#!/bin/bash
# plaxio-verify.sh — Wrapper that Plaxio calls for formal verification.
#
# Usage: plaxio-verify.sh <st-file> [--k-step N] [--timeout S] [--no-color]
#
# Pipeline:
#   1. If ESBMC-PLC+ binary exists → call it directly (it handles MATIEC internally)
#   2. If only vanilla ESBMC + MATIEC exist → run MATIEC first, then ESBMC on the C output
#   3. If Docker image exists → docker run
#
# Exit codes:
#   0 = VERIFICATION SUCCESSFUL
#   1 = VERIFICATION FAILED (counterexample found)
#   2 = Parse/compilation error
#   137 = Timeout (SIGKILL)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ST_FILE="${1:?Usage: plaxio-verify.sh <st-file> [options]}"
shift

# Parse remaining args
K_STEP=100
TIMEOUT=30
NO_COLOR=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --k-step) K_STEP="$2"; shift 2 ;;
    --timeout) TIMEOUT="$2"; shift 2 ;;
    --no-color) NO_COLOR="--no-color"; shift ;;
    --k-induction) shift ;;  # always enabled
    *) shift ;;
  esac
done

# Strategy 1: bundled esbmc-plcplus binary (handles everything internally)
ESBMC_BIN="$SCRIPT_DIR/esbmc"
if [[ -x "$ESBMC_BIN" ]]; then
  exec "$ESBMC_BIN" "$ST_FILE" \
    --k-induction --k-step "$K_STEP" \
    --timeout "$TIMEOUT" \
    $NO_COLOR
fi

# Strategy 2: system-installed esbmc-plcplus
if command -v esbmc-plcplus &>/dev/null; then
  exec esbmc-plcplus "$ST_FILE" \
    --k-induction --k-step "$K_STEP" \
    --timeout "$TIMEOUT" \
    $NO_COLOR
fi

# Strategy 3: system-installed esbmc (vanilla) + iec2c (MATIEC)
if command -v esbmc &>/dev/null && command -v iec2c &>/dev/null; then
  TMPDIR=$(mktemp -d)
  trap 'rm -rf "$TMPDIR"' EXIT

  # Compile ST → C via MATIEC (iec2c)
  iec2c -I /usr/share/matiec/lib -T "$TMPDIR" "$ST_FILE" 2>&1 || {
    echo "ERROR: MATIEC (iec2c) failed to compile ST file"
    exit 2
  }

  # Find the generated C file
  C_FILE=$(find "$TMPDIR" -name "*.c" -not -name "accessor.c" -not -name "iec_std_lib.h" | head -1)
  if [[ -z "$C_FILE" ]]; then
    echo "ERROR: MATIEC produced no C output"
    exit 2
  fi

  # Run ESBMC on the C file
  exec esbmc "$C_FILE" \
    --k-induction --k-step "$K_STEP" \
    --timeout "$TIMEOUT" \
    $NO_COLOR \
    --no-bounds-check --no-pointer-check
fi

# Strategy 4: Docker
if command -v docker &>/dev/null; then
  ST_DIR="$(dirname "$ST_FILE")"
  ST_BASE="$(basename "$ST_FILE")"
  exec docker run --rm \
    -v "$ST_DIR:/work" -w /work \
    pierredantas/esbmc-plcplus \
    esbmc "/work/$ST_BASE" \
    --k-induction --k-step "$K_STEP" \
    --timeout "$TIMEOUT" \
    $NO_COLOR
fi

echo "ERROR: No verification engine found."
echo "Install ESBMC-PLC+ binary, Docker image, or iec2c + vanilla ESBMC."
echo "Run: vendor/esbmc-plcplus/install.sh"
exit 2
