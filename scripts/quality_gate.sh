#!/usr/bin/env bash
set -euo pipefail

if [ -d backend ]; then
  (cd backend && composer validate --no-check-publish)
  (cd backend && php artisan test)
  (cd backend && ./vendor/bin/pint --test)
  if [ -x backend/vendor/bin/phpstan ]; then
    (cd backend && ./vendor/bin/phpstan analyse)
  else
    echo "Skipping phpstan: backend/vendor/bin/phpstan is not installed."
  fi
fi

if [ -d frontend ]; then
  (cd frontend && npm run typecheck)
  (cd frontend && npm run lint)
  (cd frontend && npm run test)
  (cd frontend && npm run build)
fi
