#!/usr/bin/env bash
set -euo pipefail

if [ ! -d backend ]; then
  echo "Abort: backend directory was not found."
  exit 1
fi

env_value() {
  local key="$1"
  local fallback="${2:-}"
  local value="${!key:-}"
  local line

  if [ -z "$value" ] && [ -f backend/.env ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%$'\r'}"
      case "$line" in
        "$key="*)
          value="${line#*=}"
          value="${value%\"}"
          value="${value#\"}"
          ;;
      esac
    done < backend/.env
  fi

  if [ -z "$value" ]; then
    value="$fallback"
  fi

  printf '%s' "$value"
}

APP_ENV_VALUE="$(env_value APP_ENV local)"
DB_CONNECTION_VALUE="$(env_value DB_CONNECTION sqlite)"
DB_DATABASE_VALUE="$(env_value DB_DATABASE "")"

if [ "${HOSPITAL_ALLOW_DESTRUCTIVE_RESET:-}" != "1" ]; then
  echo "Abort: this script runs php artisan migrate:fresh --seed and destroys the active database."
  echo "Set HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1 only for disposable local/testing/demo databases."
  exit 1
fi

case "$APP_ENV_VALUE" in
  local|testing) ;;
  *)
    echo "Abort: APP_ENV must be local or testing for destructive reset. Current APP_ENV=${APP_ENV_VALUE}."
    exit 1
    ;;
esac

DB_NAME_LOWER="${DB_DATABASE_VALUE,,}"
DB_CONNECTION_LOWER="${DB_CONNECTION_VALUE,,}"

if [ "$DB_CONNECTION_LOWER" = "sqlite" ] && [ "$APP_ENV_VALUE" = "testing" ]; then
  DB_IS_DISPOSABLE=1
elif [[ "$DB_NAME_LOWER" == *test* || "$DB_NAME_LOWER" == *demo* || "$DB_NAME_LOWER" == *local* ]]; then
  DB_IS_DISPOSABLE=1
else
  DB_IS_DISPOSABLE=0
fi

if [ "$DB_IS_DISPOSABLE" != "1" ]; then
  echo "Abort: DB_DATABASE must look disposable (contains test/demo/local) or use sqlite in testing."
  echo "Current DB_CONNECTION=${DB_CONNECTION_VALUE}; DB_DATABASE=${DB_DATABASE_VALUE:-<empty>}."
  exit 1
fi

echo "Running destructive dev/testing reset against APP_ENV=${APP_ENV_VALUE}, DB_CONNECTION=${DB_CONNECTION_VALUE}, DB_DATABASE=${DB_DATABASE_VALUE:-<empty>}."
(cd backend && php artisan migrate:fresh --seed)
(cd backend && php artisan test --colors=never)
