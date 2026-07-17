# CI / CD

This repository currently ships with one GitHub Actions workflow under
[`.github/workflows/`](../.github/workflows/):

## ci.yml — on every push and pull request

Five jobs run with a short security preflight before dependency installation:

| Job | What it does | Database | Timeout |
|---|---|---|---|
| `supply-chain` | Self-tests the local guard and scans all manifests/locks before installs | n/a | 5 min |
| `backend-sqlite` | PHPUnit + Pint + PHPStan + PowerShell tests | SQLite in-memory | 20 min |
| `backend-mariadb` | Full PHPUnit suite against a real MariaDB 11.4 service container | MariaDB 11.4 | 30 min |
| `frontend` | supply-chain guard pre/post pnpm frozen install + audit, typecheck, ESLint, Vitest, Vite build + bundle budget | n/a | 20 min |
| `e2e-mocked` | Playwright production-readiness spec (route-mocked) | n/a | 25 min |

The two backend jobs and frontend depend on `supply-chain`, then run in parallel.
Concurrency is collapsed per ref so a push to a feature branch cancels any
previous in-flight run for the same branch.

Every external action is pinned to its reviewed 40-character commit SHA; the
release version remains beside it as a maintenance comment. Dependabot checks
the `github-actions` ecosystem weekly so updates arrive as reviewable changes
instead of silently moving the code executed by CI.

PHP extensions installed in CI: `intl, mbstring, pdo_mysql,
pdo_sqlite, zip, gd, bcmath, opcache` (bcmath was added in
[FASE A4](#fase-a4)).

The MariaDB job validates behaviour that SQLite in-memory cannot:
real `lockForUpdate` semantics, generated columns, JSON columns, and
`utf8mb4_unicode_ci` collation.

## Release Workflow

There is no `release.yml` workflow in the current repository. Do not document or
depend on tag automation until that workflow is added and verified.

## Local equivalent

The current local Docker gate uses explicit commands. The older
`scripts/quality_gate.sh`, `scripts/quality_gate_destructive.sh`, and
`scripts/quality_gate_windows.ps1` wrappers are not present in this repository.

```bash
docker compose up -d
docker compose exec backend composer validate --no-interaction
docker compose exec backend composer audit --no-interaction
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G
docker compose exec frontend npm audit --audit-level=high
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test:critical
docker compose exec frontend npm run build
docker compose exec frontend npm run budget:bundle
```

For Playwright, prefer the divided critical specs documented in
`docs/testing-report.md` when the full historical matrix times out in Docker.

## Secrets and dependency audits in CI

The CI workflow does not hardcode production-like secrets:

- `APP_KEY` is generated at runtime with `php artisan key:generate --force`.
- The MariaDB job reads `CI_MARIADB_PASSWORD` and
  `CI_MARIADB_ROOT_PASSWORD` from GitHub Secrets or repository variables, with
  non-production fallback strings used only inside the ephemeral service
  container.
- `composer audit --locked --no-interaction` runs from the lockfile before
  `composer install` in both backend jobs.
- The frontend job self-tests the repository supply-chain guard, scans npm,
  pnpm and Composer locks before installation, and scans installed artifacts
  again before consulting advisories.
- pnpm may execute dependency builds only for `esbuild`; unreviewed lifecycle
  scripts fail the frozen install instead of being accepted globally.
- `pnpm audit --audit-level high` runs after the frozen frontend install and
  blocks known high or critical advisories before typecheck and tests.
- `pnpm run budget:bundle` checks the already-built production assets and
  blocks growth beyond the versioned startup and total gzip limits.

No real production credentials are referenced.

## Local PHP environment setup

For `vendor/bin/phpstan analyse` to work locally, the dev
dependencies must be installed. The repo ships with `composer.json`
declaring `larastan/larastan ^3.10` as a `require-dev` package, but
`vendor/` is not committed.

```bash
cd backend
composer install --no-interaction --no-progress
vendor/bin/phpstan analyse --no-progress --memory-limit=2G
```

If `composer` is not on PATH, install it from
<https://getcomposer.org/download/> or use the bundled
`composer-setup.php` with `php`:

```bash
php composer-setup.php --install-dir=/path/to/php --filename=composer
```

The CI workflow runs `composer install` before phpstan, so the
analyser is always present in CI. The local gate mirrors that.
