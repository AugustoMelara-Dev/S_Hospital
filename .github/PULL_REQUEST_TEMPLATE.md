# Pull request

## What

<!-- One or two sentences. What does this PR change? -->

## Why

<!-- Link the audit phase, ticket, or operator report. Why is this
     change necessary right now? -->

## How to test

<!-- Concrete steps a reviewer can follow on a fresh checkout.
     Include the commands to run and the data fixtures to load. -->

```bash
# backend
docker compose exec backend php artisan migrate --seed
docker compose exec backend vendor/bin/phpunit

# frontend
npm run typecheck
npm run lint
npm run test
```

## Screenshots

<!-- Required for any user-facing change. Drag a PNG or paste a link.
     For cashier/receipts flows, attach a thermal-printer preview. -->

## Risks

<!-- What could break? What is the rollback plan? Did you touch the
     schema, the public API, or any auth/permission rules? -->

## Audit checklist

- [ ] Conventional Commit subject line
- [ ] `scripts/quality_gate.sh` is green locally
- [ ] `docs/DECISIONS.md` updated if a non-obvious choice was made
- [ ] No secrets, no real patient data, no `.env` values
- [ ] Migrations are idempotent and re-runnable from zero
