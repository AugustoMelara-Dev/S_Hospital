#!/usr/bin/env bash
set -euo pipefail

if [ -d backend ]; then
  (cd backend && composer validate)
  (cd backend && php artisan test --colors=never)
  (cd backend && ./vendor/bin/pint --test)
  (cd backend && php artisan config:cache --no-ansi)
  (cd backend && php artisan config:clear --no-ansi)
  if [ -x backend/vendor/bin/phpstan ]; then
    (cd backend && ./vendor/bin/phpstan analyse)
  else
    echo "Optional static analysis skipped: backend/vendor/bin/phpstan is not installed and is not part of the current required gate."
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
