#!/usr/bin/env bash
set -euo pipefail

if [ -d backend ]; then
  (cd backend && composer validate --no-check-publish)
  (cd backend && php artisan test)
  (cd backend && ./vendor/bin/pint --test || true)
  if [ -x backend/vendor/bin/phpstan ]; then (cd backend && ./vendor/bin/phpstan analyse); fi
fi

if [ -d frontend ]; then
  (cd frontend && npm run typecheck)
  (cd frontend && npm run lint)
  (cd frontend && npm run test -- --run || npm run test)
  (cd frontend && npm run build)
fi
