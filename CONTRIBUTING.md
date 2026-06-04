# Contributing to S_Hospital

S_Hospital is the cashier, billing and reporting system for the
Hospital San Isidro. The system runs **offline on a local LAN**:
one PC server, several cashier PCs, no cloud. Every change must
respect that operational model.

## Code of conduct

We work for the people who use the system every day (cashiers,
supervisors, administrators, and ultimately the patients whose
data the system holds). The four rules:

1. **Be respectful.** Disagree on technical merit, never on people.
2. **Focus on the user.** Cashiers must be able to operate the
   system during a 12-hour shift without errors and without
   having to call IT. UX regressions are not minor.
3. **Follow the audit plan.** The system has a 20-phase
   hardening roadmap (see `docs/AUDIT_2026_06_02.md` and
   `docs/OPERATIVE_NOTES_2026_06_02.md`). Random changes that
   bypass the plan add risk.
4. **Commit atomically.** One Conventional Commit per logical
   change. If a commit is hard to describe in one line, split it.

## Branch policy

- `main` is the only long-lived branch. Tags (v1.0.0, v1.0.1,
  …) live on `main`.
- Work happens on `codex/audit-*` branches named after the phase
  in the audit plan (e.g. `codex/audit-f1-config-hardening`,
  `codex/audit-f2-dead-code`).
- Hotfixes use `fix/<short-description>`.
- Force-push is forbidden on shared branches.

## Commit format

[Conventional Commits](https://www.conventionalcommits.org/) is
mandatory. The format is:

```
<type>(<scope>): <short description>

<body explaining WHY, not WHAT (the diff shows what)>
```

Types used in this repo: `feat`, `fix`, `chore`, `refactor`,
`docs`, `test`, `ci`, `perf`, `ops`. Scopes: `backend`, `frontend`,
`billing`, `cash`, `payments`, `reports`, `backups`, `pos`, `cashbox`,
`docker`, `ci`, `ops`, `docs`, `audit`.

## Pull request template

Use `.github/PULL_REQUEST_TEMPLATE.md`. Every PR must answer:

- **What** does this change? (1-3 bullets)
- **Why** is it needed? (link to the audit issue / phase plan)
- **How to test** locally (`docker compose up -d`, `npm run test`,
  `php artisan test`, etc.)
- **Screenshots** if the change is user-visible
- **Risks** and rollback plan

## Pre-commit hook

Install the secret-leak guard locally so you never accidentally
commit `APP_KEY` or `DB_PASSWORD`:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\install_dev_hooks.ps1
```

The hook is enforced in CI as a fallback. The pre-commit guard
blocks `APP_KEY=base64:...` with a real value, `HOSPITAL_LICENSE_SALT`
with a non-empty value, `.env` files (outside `*.env.example`),
and any file inside `nginx/ssl/`. See `docs/SECRETS.md`.

## Quality gate

Every PR must pass `scripts/quality_gate.sh` locally before
requesting review. The same gate runs in CI on every push.

For Backend changes:

```bash
cd backend
php -d memory_limit=512M vendor/bin/phpunit
vendor/bin/pint --test
vendor/bin/phpstan analyse --no-progress
```

For Frontend changes:

```bash
cd frontend
npm run typecheck
npm run lint
npm run test
npm run build
```

If you change the database schema:

```bash
cd backend
php artisan migrate:fresh --seed
```

If you change the docker bundle:

```bash
powershell -ExecutionPolicy Bypass -File scripts\make_offline_release.ps1 -SelfTest
```

## Working agreement

- **No commented-out code.** If a feature is removed, delete
  it. Git remembers.
- **No dead exports.** Every public function, route, and React
  component must be reachable from a feature.
- **No float money.** All money math is in integer cents. See
  `App\Support\Money` and `frontend/src/lib/moneyCents.ts`.
- **No SaaS dependencies.** The system runs offline. The
  pre-commit guard enforces this.

## License

S_Hospital is proprietary software for Hospital San Isidro. By
contributing you agree that the contributor's work is owned by
the hospital under the same license as the rest of the
repository.
