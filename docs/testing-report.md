# Testing Report

Living verification report for the S_Hospital total refactor. This document is
evidence for the current branch, not a production approval.

Status date: 2026-07-02
Branch: `codex/refactor-total`
Production approval: NO

## Current Focus

The latest verification pass moved from local frontend-only evidence to the
Docker stack. It confirmed the containerized Laravel, MySQL/MariaDB and
frontend services can boot, migrate, seed, run focused backend gates, and pass
the frontend lint/typecheck/test/build path.

The focused Playwright gates remain mocked and non-mutating. They prove frontend
contracts, RBAC visibility, payload shape, and accessible UI behavior. They do
not replace real LAN, printer, backup scheduler, restore dry-run, or physical
print validation.

## Verified Commands

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-07-02 | `npm run test` | PASS, 100 files / 552 tests | Local Vitest run from `frontend`; not Docker. |
| 2026-07-02 | `npm run build` | PASS | Local production build: `tsc --noEmit && vite build`; largest chunks `vendor` 398.37 kB gzip 121.92 kB and `charts` 357.04 kB gzip 104.93 kB. |
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 8 tests | Fresh focused gate for accessibility, invoice/payment, reports, cashbox close and invoice voiding. |
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts` | PASS, 2 tests | Login and critical protected routes: one `h1`, `main`, named controls, no serious/critical axe issues. |
| 2026-07-02 | `npx playwright test e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts` | PASS, 4 tests | Invoice payload/payment payload/PDF request; reports filters/export/cash/audit. |
| 2026-07-02 | `npx playwright test e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 2 tests | Cash close difference requires note; invoice void requires reason and row ActionMenu. |
| 2026-07-02 | `npm run lint` | PASS | Frontend lint. |
| 2026-07-02 | `npm run typecheck` | PASS | TypeScript no emit. |
| 2026-07-02 | `docker compose up -d` | PASS | `mysql`, `backend`, and `frontend` containers started; MySQL healthy on local mapped port 3307. |
| 2026-07-02 | `docker compose exec backend php artisan migrate --seed` | PASS | Applied pending receipt/fiscal permission migrations and completed core seeders. |
| 2026-07-02 | `docker compose exec backend php artisan test` | TIMEOUT | Timed out after about 304 seconds with no final result. Full backend PHPUnit remains open. |
| 2026-07-02 | `docker compose exec backend php artisan test --testsuite=Unit` | PASS, 147 passed / 2 skipped | 598 assertions. Skips were MySQL-specific admin audit support tests. |
| 2026-07-02 | `docker compose exec backend php artisan test tests/Feature/ReceiptPrintProfileAdvancedFieldsTest.php tests/Feature/CloseCashSessionDifferenceTest.php tests/Feature/Resilience/IdempotencyKeyTest.php tests/Feature/BackupWorkflowTest.php tests/Feature/UserManagementTest.php` | PASS, 71 tests | 382 assertions covering receipt advanced-field RBAC/audit, cash close difference notes, idempotency, backups, and user management. |
| 2026-07-02 | `docker compose exec backend vendor/bin/pint --test` | PASS | 423 files checked. |
| 2026-07-02 | `docker compose exec backend vendor/bin/phpstan analyse` | FAIL | Default parallel worker ended with child process error exit code 255; no code errors were reported before the worker failure. |
| 2026-07-02 | `docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G` | PASS | 211/211 files, no errors. This is the stable backend static-analysis gate for this pass. |
| 2026-07-02 | `docker compose exec frontend npm run lint` | PASS | Containerized frontend lint. |
| 2026-07-02 | `docker compose exec frontend npm run typecheck` | PASS | Containerized TypeScript no emit. |
| 2026-07-02 | `docker compose exec frontend npm run test` | PASS, 101 files / 557 tests | Containerized Vitest. React `act(...)` and TanStack Query undefined-data warnings remain test hygiene items. |
| 2026-07-02 | `docker compose exec frontend npm run build` | PASS | Containerized production build. Largest chunks: `vendor` 398.37 kB gzip 121.92 kB, `charts` 357.04 kB gzip 104.93 kB, `index` 236.04 kB gzip 59.20 kB. |

Recharts emits a known Playwright/Vite console warning about chart container
dimensions in the mocked browser run. It does not currently fail the focused
gates, but it remains a visual/performance review item for final QA.

The containerized Vitest run also emits React `act(...)` warnings in invoice and
settings tests plus TanStack Query warnings for mocked `cash-sessions` movements
and executive reports data returning `undefined`. They do not fail the suite,
but they remain cleanup targets before final acceptance.

## Focused E2E Coverage Added

| Spec | Critical behavior covered |
|---|---|
| `frontend/e2e/accessibility.spec.ts` | WCAG smoke for login and critical routes, one visible `h1`, `main` landmark, named controls, axe serious/critical gate. |
| `frontend/e2e/new-invoice-flow.spec.ts` | Open cash session, patient, service search, invoice emission, payment registration payload, institutional receipt PDF request. |
| `frontend/e2e/reports-flow.spec.ts` | Executive filters, PDF/Excel export, cash session lookup, audit counters. |
| `frontend/e2e/cashbox.spec.ts` | Close cash session wizard/difference/note requirement/payload. |
| `frontend/e2e/invoice-history-flow.spec.ts` | Patient filter, row action menu, void dialog, reason payload. |
| `frontend/e2e/backups-flow.spec.ts` | Safe backup status, create confirmation, no restore/delete actions. |
| `frontend/e2e/settings-flow.spec.ts` | Fiscal/receipt settings gates and receipt paper separation. |
| `frontend/e2e/catalog-flow.spec.ts` | Service search, ActionMenu, deactivate confirmation. |
| `frontend/e2e/users-flow.spec.ts` | User management and permission/role controls. |
| `frontend/e2e/auth.spec.ts` / `frontend/e2e/rbac.spec.ts` | Auth/session and route permission gates. |

## Required Final Gates Still Open

These commands or equivalent full gates are still required before final
completion can be claimed:

```bash
docker compose exec backend php artisan test
docker compose exec frontend npx playwright test
```

The Docker stack, backend migrations/seeders, backend Unit suite, focused
backend Feature suite, Pint, PHPStan with `--memory-limit=1G`, frontend lint,
frontend typecheck, frontend Vitest, and frontend build are now proven green for
this pass. Full backend PHPUnit still needs a successful non-timeout run, and
full Playwright in Docker still needs to be executed.

If any full-suite command is too slow or environment-bound, the blocker and the
latest focused substitute must be recorded in `docs/refactor-total-audit.md`.

## Backend Status

Backend verification is stronger but not final:

- migrations and seeders pass in Docker;
- Unit suite passes: 147 passed, 2 skipped, 598 assertions;
- focused Feature suite passes: 71 passed, 382 assertions;
- Pint passes across 423 files;
- PHPStan passes with `--memory-limit=1G` across 211 files;
- full `php artisan test` timed out after about 304 seconds and remains open;
- default PHPStan parallel execution failed with worker exit code 255, while the
  memory-limited rerun completed cleanly.

## Manual/Physical QA Still Required

- real LAN login and route access by server IP;
- real MySQL/MariaDB migrations and seeders from zero;
- physical or PDF print checks for Carta, Media carta and A5;
- backup worker/scheduler behavior on the server;
- restore runbook dry-run outside the app;
- invoice/payment/cashbox flow against a real database;
- browser zoom/responsive checks at 1366x768 and 125%.

## Current Conclusion

The focused mocked frontend gates are improving and currently green for the
covered critical flows. The total refactor is not complete until the full
backend, frontend, E2E, print, LAN/offline, and manual QA requirements above are
verified.
