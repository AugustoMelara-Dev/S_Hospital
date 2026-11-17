#!/bin/sh
# Espera la base de datos, aplica migraciones y siembra datos base (idempotente).
set -e

echo "[shs] esperando base de datos..."
i=0
until python -c "from sqlalchemy import create_engine, text; from app.config import get_settings; e=create_engine(get_settings().resolved_database_url); c=e.connect(); c.execute(text('select 1')); c.close()" 2>/dev/null; do
  i=$((i+1))
  if [ "$i" -ge 60 ]; then echo "[shs] la base de datos no respondió"; exit 1; fi
  sleep 2
done

echo "[shs] aplicando migraciones..."
python -m app.cli migrate

if [ "${SHS_SEED_DEMO:-false}" = "true" ]; then
  python -m app.cli seed --demo
else
  python -m app.cli seed
fi

if [ -n "${SHS_ADMIN_USERNAME:-}" ] && [ -n "${SHS_ADMIN_PASSWORD:-}" ]; then
  python -m app.cli create-admin --username "$SHS_ADMIN_USERNAME" --name "${SHS_ADMIN_NAME:-Administrador}" || true
fi

exec "$@"
