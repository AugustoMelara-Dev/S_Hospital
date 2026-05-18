#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${HOSPITAL_PROJECT_ROOT:-$(pwd)}"
BACKEND_DIR="$ROOT_DIR/backend"

env_value() {
  local key="$1"
  local fallback="${2:-}"
  local value="${!key:-}"
  local line

  if [ -z "$value" ] && [ -f "$BACKEND_DIR/.env" ]; then
    while IFS= read -r line || [ -n "$line" ]; do
      line="${line%$'\r'}"
      case "$line" in
        "$key="*)
          value="${line#*=}"
          value="${value%\"}"
          value="${value#\"}"
          ;;
      esac
    done < "$BACKEND_DIR/.env"
  fi

  if [ -z "$value" ]; then
    value="$fallback"
  fi

  printf '%s' "$value"
}

APP_ENV_VALUE="$(env_value APP_ENV local)"
DB_CONNECTION_VALUE="$(env_value DB_CONNECTION mysql)"
DB_HOST_VALUE="$(env_value DB_HOST 127.0.0.1)"
DB_PORT_VALUE="$(env_value DB_PORT 3306)"
DB_DATABASE_VALUE="$(env_value DB_DATABASE hospital_billing)"
DB_USERNAME_VALUE="$(env_value DB_USERNAME hospital)"
DB_PASSWORD_VALUE="$(env_value DB_PASSWORD "")"
RESTORE_TEST_DATABASE_VALUE="${RESTORE_TEST_DATABASE:-}"
RESTORE_TEST_DATABASE_LOWER="${RESTORE_TEST_DATABASE_VALUE,,}"
DB_DATABASE_LOWER="${DB_DATABASE_VALUE,,}"

if [ "${HOSPITAL_VALIDATE_RESTORE_MYSQL:-}" != "1" ]; then
  echo "Abort: set HOSPITAL_VALIDATE_RESTORE_MYSQL=1 to run restore validation."
  exit 1
fi

# This script intentionally drops and recreates RESTORE_TEST_DATABASE.
# Run it only against a disposable restore-validation database, never against
# the active hospital database.
if [ -z "$RESTORE_TEST_DATABASE_VALUE" ]; then
  echo "Abort: RESTORE_TEST_DATABASE must be set to an explicit disposable database name."
  exit 1
fi

if [[ ! "$RESTORE_TEST_DATABASE_VALUE" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "Abort: RESTORE_TEST_DATABASE must contain only letters, numbers, and underscores."
  exit 1
fi

if [ "$RESTORE_TEST_DATABASE_LOWER" = "$DB_DATABASE_LOWER" ]; then
  echo "Abort: RESTORE_TEST_DATABASE must be different from the active DB_DATABASE."
  exit 1
fi

case "$RESTORE_TEST_DATABASE_LOWER" in
  production|prod|hospital|hospital_billing|mysql|information_schema|performance_schema|sys)
    echo "Abort: RESTORE_TEST_DATABASE uses a sensitive or reserved database name."
    exit 1
    ;;
esac

case "$RESTORE_TEST_DATABASE_LOWER" in
  *test*|*restore*|*validation*|*disposable*) ;;
  *)
    echo "Abort: RESTORE_TEST_DATABASE must clearly contain test, restore, validation, or disposable."
    exit 1
    ;;
esac

if [ "${HOSPITAL_CONFIRM_RESTORE_DATABASE:-}" != "$RESTORE_TEST_DATABASE_VALUE" ]; then
  echo "Abort: set HOSPITAL_CONFIRM_RESTORE_DATABASE=${RESTORE_TEST_DATABASE_VALUE} to confirm the disposable restore target."
  exit 1
fi

case "${DB_CONNECTION_VALUE,,}" in
  mysql|mariadb) ;;
  *)
    echo "Abort: restore validation requires DB_CONNECTION=mysql or mariadb. Current DB_CONNECTION=${DB_CONNECTION_VALUE}."
    exit 1
    ;;
esac

if [ "$APP_ENV_VALUE" = "production" ] && [ "${HOSPITAL_ALLOW_PRODUCTION_VALIDATION:-}" != "1" ]; then
  echo "Abort: refusing to run restore validation against APP_ENV=production without HOSPITAL_ALLOW_PRODUCTION_VALIDATION=1."
  exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
  echo "Abort: mysql client is required for restore validation."
  exit 1
fi

if ! command -v mariadb-dump >/dev/null 2>&1 && ! command -v mysqldump >/dev/null 2>&1; then
  echo "Abort: mariadb-dump or mysqldump is required for backup creation."
  exit 1
fi

echo "Creating source backup with php artisan hospital:backup --type=manual."
(cd "$BACKEND_DIR" && php artisan hospital:backup --type=manual)

BACKUP_PATH="$(cd "$BACKEND_DIR" && php -r '
require __DIR__."/vendor/autoload.php";
$app = require __DIR__."/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
echo App\Models\BackupLog::query()->where("status", "success")->latest()->first()?->path ?? "";
' 2>/dev/null)"

if [ -z "$BACKUP_PATH" ]; then
  echo "Abort: no successful backup log was found after backup command."
  exit 1
fi

BACKUP_ABSOLUTE="$BACKEND_DIR/storage/app/private/$BACKUP_PATH"
if [ ! -f "$BACKUP_ABSOLUTE" ]; then
  BACKUP_ABSOLUTE="$BACKEND_DIR/storage/app/$BACKUP_PATH"
fi

if [ ! -f "$BACKUP_ABSOLUTE" ]; then
  echo "Abort: backup file recorded by backup_logs was not found."
  exit 1
fi

echo "WARNING: disposable database ${RESTORE_TEST_DATABASE_VALUE} will be dropped and recreated."
echo "Restoring backup into disposable database ${RESTORE_TEST_DATABASE_VALUE}."
export MYSQL_PWD="$DB_PASSWORD_VALUE"
mysql --host="$DB_HOST_VALUE" --port="$DB_PORT_VALUE" --user="$DB_USERNAME_VALUE" \
  -e "DROP DATABASE IF EXISTS \`${RESTORE_TEST_DATABASE_VALUE}\`; CREATE DATABASE \`${RESTORE_TEST_DATABASE_VALUE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql --host="$DB_HOST_VALUE" --port="$DB_PORT_VALUE" --user="$DB_USERNAME_VALUE" "$RESTORE_TEST_DATABASE_VALUE" < "$BACKUP_ABSOLUTE"

echo "Restore validation completed. Backup: $BACKUP_ABSOLUTE"
echo "Next manual checks: point a temporary .env to ${RESTORE_TEST_DATABASE_VALUE}, then run php artisan migrate:status, php artisan config:cache --no-ansi, and browser checks for /up, /login, /verify-email."
