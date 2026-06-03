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

until ${DB_BIN} \
  --host="${DB_HOST:-127.0.0.1}" \
  --port="${DB_PORT:-3306}" \
  --user="${DB_USERNAME:-hospital}" \
  --password="${DB_PASSWORD:-}" \
  --execute='SELECT 1' >/dev/null 2>&1; do
  elapsed=$((elapsed + WAIT_INTERVAL))
  if [ "$elapsed" -ge "$DB_READY_TIMEOUT" ]; then
    echo "[entrypoint] ERROR: MariaDB no respondio en ${DB_READY_TIMEOUT}s."
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
