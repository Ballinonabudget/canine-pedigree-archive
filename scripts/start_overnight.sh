#!/usr/bin/env bash
# ==============================================================================
# scripts/start_overnight.sh
# Keeps M1 Mac awake and runs autonomous 3:00 AM EST batch processor.
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PYTHON_BIN="$DIR/.venv/bin/python"
RUNNER="$DIR/scripts/overnight_auto_runner.py"

cd "$DIR"

echo "======================================================================"
echo "STARTING AUTONOMOUS OVERNIGHT RUNNER (3:00 AM EST BATCH FINISHER)"
echo "Working Directory: $DIR"
echo "Log file:          $DIR/overnight_runner.log"
echo "======================================================================"

# Execute caffeinate wrapped around the overnight auto runner
caffeinate -dimsu "$PYTHON_BIN" "$RUNNER"
