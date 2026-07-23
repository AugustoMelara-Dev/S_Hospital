#!/bin/sh
set -eu

cd /var/www/html

if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction
fi

if [ ! -f .env ]; then
  cp .env.docker.example .env
  php artisan key:generate --force
fi

if [ ! -f bootstrap/cache/config.php ]; then
  php artisan config:cache --no-interaction
fi

if [ ! -f bootstrap/cache/routes-v7.php ]; then
  php artisan route:cache --no-interaction
fi

cd public
php -S 0.0.0.0:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php &
server_pid=$!

stop_server() {
  kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap stop_server INT TERM EXIT

until curl --max-time 2 -fsS http://127.0.0.1:8000/healthz.txt >/dev/null; do
  if ! kill -0 "$server_pid" 2>/dev/null; then
    wait "$server_pid"
    exit $?
  fi
  sleep 1
done

# PHP's CLI server forks workers before Laravel is loaded. Warm more requests
# than workers so every process compiles the framework once before Docker
# declares the service ready.
warmup_requests="${APP_BOOT_WARMUP_REQUESTS:-9}"
warmup_pids=""
request=0
while [ "$request" -lt "$warmup_requests" ]; do
  curl --max-time 45 -fsS http://127.0.0.1:8000/up >/dev/null &
  warmup_pids="$warmup_pids $!"
  request=$((request + 1))
done

for warmup_pid in $warmup_pids; do
  wait "$warmup_pid" || true
done

warmup_pids=""
request=0
while [ "$request" -lt "$warmup_requests" ]; do
  curl --max-time 45 -fsS http://127.0.0.1:8000/api/auth/session >/dev/null &
  warmup_pids="$warmup_pids $!"
  request=$((request + 1))
done

for warmup_pid in $warmup_pids; do
  wait "$warmup_pid" || true
done

echo "[local-server] Laravel listo con OPcache precalentado."
wait "$server_pid"
