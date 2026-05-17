#!/usr/bin/env bash
set -euo pipefail

if [ "${HOSPITAL_VALIDATE_REAL_MYSQL:-}" != "1" ]; then
  echo "Abort: set HOSPITAL_VALIDATE_REAL_MYSQL=1 to run real MySQL/MariaDB concurrency validation."
  exit 1
fi

node scripts/validate_mysql_concurrency.mjs
