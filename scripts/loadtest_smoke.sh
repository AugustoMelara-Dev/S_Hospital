#!/usr/bin/env bash
# =============================================================================
# Lightweight load-test smoke for S_Hospital.
#
# Runs the fiscal-race node script against a target and fails the
# build (exit 1) when:
#   - any request returns 5xx
#   - any duplicate fiscal number is observed
#   - p99 latency exceeds 3s
#
# Use this in CI (or as a final production check after install) to
# guard the most painful regressions without spinning up k6.
#
# Usage:
#   BASE_URL=https://192.168.1.10 \
#   HOSPITAL_LOADTEST_TARGET_ENV=validation \
#   HOSPITAL_CONFIRM_LOADTEST_TARGET=https://192.168.1.10 \
#   CASHIER_USER=validacion.caja1 CASHIER_PASSWORD=... \
#   bash scripts/loadtest_smoke.sh
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-}"
CASHIER_USER="${CASHIER_USER:-}"
CASHIER_PASSWORD="${CASHIER_PASSWORD:-}"
HOSPITAL_LOADTEST_TARGET_ENV="${HOSPITAL_LOADTEST_TARGET_ENV:-}"
HOSPITAL_CONFIRM_LOADTEST_TARGET="${HOSPITAL_CONFIRM_LOADTEST_TARGET:-}"
RACE_PARALLEL="${RACE_PARALLEL:-4}"
RACE_TOTAL="${RACE_TOTAL:-20}"

if [ -z "${BASE_URL}" ] || [[ "${BASE_URL}" != https://* ]]; then
  echo "FAIL: BASE_URL is required and must use HTTPS."
  exit 2
fi

if [ -z "${CASHIER_USER}" ]; then
  echo "FAIL: CASHIER_USER is required and must identify a temporary validation account."
  exit 2
fi

case "${CASHIER_PASSWORD}" in
  Cambio1234|password|admin|123456)
    echo "FAIL: CASHIER_PASSWORD looks like a demo/default password."
    exit 2
    ;;
esac

case "${HOSPITAL_LOADTEST_TARGET_ENV}" in
  validation|disposable|training)
    ;;
  *)
    echo "FAIL: set HOSPITAL_LOADTEST_TARGET_ENV to validation, disposable or training."
    echo "This smoke creates invoices and must not run against the real production database."
    exit 2
    ;;
esac

if [ "${HOSPITAL_CONFIRM_LOADTEST_TARGET}" != "${BASE_URL}" ]; then
  echo "FAIL: HOSPITAL_CONFIRM_LOADTEST_TARGET must exactly match BASE_URL."
  echo "BASE_URL=${BASE_URL}"
  exit 2
fi

if [ -z "${CASHIER_PASSWORD}" ]; then
  echo "FAIL: CASHIER_PASSWORD is required and must come from a temporary validation account."
  exit 2
fi

SCRIPT_SOURCE="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "${SCRIPT_SOURCE%/*}" && pwd)"
RACE_JS="${SCRIPT_DIR}/../qa/loadtest/fiscal-race.js"

if [ ! -f "${RACE_JS}" ]; then
  echo "FAIL: ${RACE_JS} not found"
  exit 2
fi

if ! command -v node >/dev/null 2>&1; then
  if [ "${ALLOW_LOADTEST_SKIP:-}" = "1" ]; then
    echo "SKIP: node not available; loadtest smoke cannot run"
    exit 0
  fi
  echo "FAIL: node not available; loadtest smoke cannot run"
  exit 2
fi

echo "[*] loadtest_smoke: target=${BASE_URL} parallel=${RACE_PARALLEL} total=${RACE_TOTAL}"
output=$(BASE_URL="${BASE_URL}" \
         CASHIER_USER="${CASHIER_USER}" \
         CASHIER_PASSWORD="${CASHIER_PASSWORD}" \
         HOSPITAL_LOADTEST_TARGET_ENV="${HOSPITAL_LOADTEST_TARGET_ENV}" \
         HOSPITAL_CONFIRM_LOADTEST_TARGET="${HOSPITAL_CONFIRM_LOADTEST_TARGET}" \
         RACE_PARALLEL="${RACE_PARALLEL}" \
         RACE_TOTAL="${RACE_TOTAL}" \
         node "${RACE_JS}")

echo "${output}"

report_file="$(mktemp)"
trap 'rm -f "${report_file}"' EXIT
printf '%s\n' "${output}" > "${report_file}"

node - "${report_file}" <<'NODE'
const fs = require('fs');
const report = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));

if (!Array.isArray(report.duplicates) || report.duplicates.length !== 0) {
  console.error('FAIL: duplicates array not empty');
  process.exit(1);
}

if (report.errors_count !== 0) {
  console.error('FAIL: errors_count > 0');
  process.exit(1);
}

const p99 = report.latency_ms && report.latency_ms.p99;
if (typeof p99 === 'number' && p99 > 3000) {
  console.error(`FAIL: p99 latency ${p99}ms exceeds 3s budget`);
  process.exit(1);
}
NODE

echo "[OK] loadtest_smoke passed"
