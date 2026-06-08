# CI / CD

This repository ships with two GitHub Actions workflows under
[`.github/workflows/`](../workflows/):

## ci.yml — on every push and pull request

Four jobs run in parallel where possible:

| Job | What it does | Database | Timeout |
|---|---|---|---|
| `backend-sqlite` | PHPUnit + Pint + PHPStan + PowerShell tests | SQLite in-memory | 20 min |
| `backend-mariadb` | Full PHPUnit suite against a real MariaDB 11.4 service container | MariaDB 11.4 | 30 min |
| `frontend` | `npm run typecheck`, `npm run lint`, Vitest, Vite build | n/a | 20 min |
| `e2e-mocked` | Playwright production-readiness spec (route-mocked) | n/a | 25 min |

Concurrency is collapsed per ref so a push to a feature branch
cancels any previous in-flight run for the same branch.

PHP extensions installed in CI: `intl, mbstring, pdo_mysql,
pdo_sqlite, zip, gd, bcmath, opcache` (bcmath was added in
[FASE A4](#fase-a4)).

The MariaDB job validates behaviour that SQLite in-memory cannot:
real `lockForUpdate` semantics, generated columns, JSON columns, and
`utf8mb4_unicode_ci` collation.

## release.yml — on every `v*` tag push

Validates the tag is releasable before creating the GitHub Release:

- `docs/RELEASE_NOTES_<tag>.md` must exist.
- All required final field evidence files under `qa/` must no longer
  contain the string `PENDING`:
  `LAN_CLIENT_VALIDATION_PROOF.md`,
  `INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`,
  `FINAL_STARTUP_TASK_PROOF.md`,
  `FINAL_RESTORE_PROOF.md`,
  `FINAL_BACKUP_TASK_PROOF.md`,
  `FINAL_CONCURRENCY_PROOF.md`, and
  `TRAINING_ACCEPTANCE_PROOF.md`.
- `qa/FINAL_PRODUCTION_HANDOFF_RESULT.md` must contain
  `PRODUCTION_READY=YES`.

If any check fails, the workflow fails and no release is created.
The release body is the contents of the matching
`docs/RELEASE_NOTES_*.md` file. Tags containing `-rc` or `-beta` are
marked as pre-releases automatically.

## Local equivalent

`scripts/quality_gate.sh` runs the same gates locally:

```bash
docker compose up -d mysql
./scripts/quality_gate.sh
```

`scripts/quality_gate_destructive.sh` adds a `migrate:fresh --seed`
reset, gated by `HOSPITAL_ALLOW_DESTRUCTIVE_RESET=1`.

## Secrets in CI

The CI workflow uses only safe placeholders:
- `APP_KEY=base64:dGVzdHRlc3R0ZXN0dGVzdHRlc3R0ZXN0dGVzdHRlc3Q=` (32 't' chars; the
  pre-commit guard allows `APP_KEY=` blank lines, but the suites need
  a non-empty key to bootstrap Sanctum).
- `DB_PASSWORD=hospital_dev` is the documented dev placeholder, which
  the production preflight explicitly rejects.

No real production credentials are referenced.
