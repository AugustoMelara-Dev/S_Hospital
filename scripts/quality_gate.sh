#!/usr/bin/env bash
set -euo pipefail

if [ -d backend ]; then
  (cd backend && composer validate)
  (cd backend && php artisan migrate:fresh --seed)
  (cd backend && php artisan test --colors=never)
  (cd backend && ./vendor/bin/pint --test)
  if [ -x backend/vendor/bin/phpstan ]; then
    (cd backend && ./vendor/bin/phpstan analyse)
  else
    echo "Skipping phpstan: backend/vendor/bin/phpstan is not installed."
  fi
fi

if [ -d frontend ]; then
  NPM_BIN="npm"
  if command -v npm.cmd >/dev/null 2>&1; then
    NPM_BIN="npm.cmd"
  fi

  (cd frontend && "$NPM_BIN" run typecheck)
  (cd frontend && "$NPM_BIN" run lint)
  (cd frontend && "$NPM_BIN" run test)
  (cd frontend && "$NPM_BIN" run build)
fi
