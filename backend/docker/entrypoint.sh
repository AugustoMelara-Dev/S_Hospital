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
rm -f "$MY_CNF_PATH"

if [ -f .env ]; then
  if ! grep -q "^APP_KEY=base64:" .env; then
    echo "[entrypoint] Generando APP_KEY..."
    php artisan key:generate --force
  fi
fi

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Ejecutando migraciones pendientes..."
  php artisan migrate --force --no-interaction
else
  echo "[entrypoint] Migraciones omitidas para este servicio."
fi

if [ -d /var/www/frontend/dist ]; then
  mkdir -p /shared_public
  cp -r /var/www/html/public/. /shared_public/ 2>/dev/null || true
  cp -r /var/www/frontend/dist/. /shared_public/
fi

echo "[entrypoint] Listo. Iniciando proceso principal: $*"
exec "$@"
