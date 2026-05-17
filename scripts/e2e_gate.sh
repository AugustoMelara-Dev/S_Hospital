#!/usr/bin/env bash
set -euo pipefail

if [ ! -d frontend ]; then
  echo "Abort: frontend directory was not found."
  exit 1
fi

NPM_BIN="npm"
if command -v npm.cmd >/dev/null 2>&1; then
  NPM_BIN="powershell.exe"
fi

if [ "$NPM_BIN" = "powershell.exe" ]; then
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/e2e_gate.ps1
else
  (cd frontend && "$NPM_BIN" run e2e)
fi
