#!/bin/sh
set -eu

cd /var/www/html

DB_READY_TIMEOUT="${DB_READY_TIMEOUT:-120}"
WAIT_INTERVAL=2
elapsed=0

echo "[entrypoint] Esperando a MariaDB en ${DB_HOST:-127.0.0.1}:${DB_PORT:-3306} (timeout ${DB_READY_TIMEOUT}s)"

if command -v mariadb >/dev/null 2>&1; then
  DB_BIN=mariadb
elif command -v mysql >/dev/null 2>&1; then
  DB_BIN=mysql
else
  echo "[entrypoint] ERROR: no se encontro mariadb ni mysql en el contenedor."
  exit 1
fi

# Escribir password en option file 0600 (no en CLI ni en MYSQL_PWD).
# MYSQL_PWD y --password= aparecen en /proc/<pid>/cmdline, accesibles a otros usuarios del host.
MY_CNF_PATH="${MY_CNF_PATH:-/tmp/.hospital-db.cnf}"
trap 'rm -f "$MY_CNF_PATH"' EXIT
{
  printf '[client]\n'
  printf 'host=%s\n' "${DB_HOST:-127.0.0.1}"
  printf 'port=%s\n' "${DB_PORT:-3306}"
  printf 'user=%s\n' "${DB_USERNAME:-hospital}"
  printf 'password=%s\n' "${DB_PASSWORD:-}"
} > "$MY_CNF_PATH"
chmod 0600 "$MY_CNF_PATH"

until ${DB_BIN} \
  --defaults-file="$MY_CNF_PATH" \
  --execute='SELECT 1' >/dev/null 2>&1; do
  elapsed=$((elapsed + WAIT_INTERVAL))
  if [ "$elapsed" -ge "$DB_READY_TIMEOUT" ]; then
    echo "[entrypoint] ERROR: MariaDB no respondio en ${DB_READY_TIMEOUT}s."
    rm -f "$MY_CNF_PATH"
    exit 1
  fi
  sleep "$WAIT_INTERVAL"
done

echo "[entrypoint] MariaDB respondio en ${elapsed}s."

if [ -f .env ]; then
  if ! grep -q "^APP_KEY=base64:" .env; then
    echo "[entrypoint] Generando APP_KEY..."
    php artisan key:generate --force
  fi
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  if [ "${APP_ENV:-}" = "production" ]; then
    MIGRATIONS_TABLE_EXISTS="$(${DB_BIN} \
      --defaults-file="$MY_CNF_PATH" \
      --database="${DB_DATABASE:-hospital_billing}" \
      --batch \
      --skip-column-names \
      --execute="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'migrations';" 2>/dev/null || printf '0')"

    if [ "$MIGRATIONS_TABLE_EXISTS" != "0" ] && [ "${HOSPITAL_MIGRATION_BACKUP_CONFIRMED:-false}" != "1" ]; then
      echo "[entrypoint] ERROR: migraciones productivas bloqueadas hasta confirmar un backup cifrado reciente."
      echo "[entrypoint] Cree/verifique el backup y ejecute con HOSPITAL_MIGRATION_BACKUP_CONFIRMED=1 solo para este upgrade."
      rm -f "$MY_CNF_PATH"
      exit 1
    fi
  fi

  echo "[entrypoint] Ejecutando migraciones pendientes..."
  php artisan migrate --force --no-interaction
else
  echo "[entrypoint] Migraciones omitidas para este servicio."
fi

rm -f "$MY_CNF_PATH"

if [ -d /var/www/frontend/dist ]; then
  mkdir -p /shared_public
  cp -r /var/www/html/public/. /shared_public/ 2>/dev/null || true
  cp -r /var/www/frontend/dist/. /shared_public/
fi

echo "[entrypoint] Listo. Iniciando proceso principal: $*"
exec "$@"
