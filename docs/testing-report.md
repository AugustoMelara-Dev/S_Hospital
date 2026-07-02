# Testing Report

Living verification report for the S_Hospital total refactor. This document is
evidence for the current branch, not a production approval.

Status date: 2026-07-02
Branch: `codex/refactor-total`
Production approval: NO

## Current Focus

The latest work strengthened the critical mocked Playwright gates for:

- invoice creation and payment;
- reports executive/cash/audit sub-routes;
- cashbox close with difference;
- invoice history voiding;
- catalog/user/backups/settings gates;
- accessibility smoke across critical protected routes.

These tests are intentionally mocked and non-mutating. They prove frontend
contracts, RBAC visibility, payload shape, and accessible UI behavior. They do
not replace real LAN, MySQL/MariaDB, printer, backup worker, or physical print
validation.

## Verified Commands

| Date | Command | Result | Notes |
|---|---|---|---|
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 8 tests | Fresh focused gate for accessibility, invoice/payment, reports, cashbox close and invoice voiding. |
| 2026-07-02 | `npx playwright test e2e/accessibility.spec.ts` | PASS, 2 tests | Login and critical protected routes: one `h1`, `main`, named controls, no serious/critical axe issues. |
| 2026-07-02 | `npx playwright test e2e/new-invoice-flow.spec.ts e2e/reports-flow.spec.ts` | PASS, 4 tests | Invoice payload/payment payload/PDF request; reports filters/export/cash/audit. |
| 2026-07-02 | `npx playwright test e2e/cashbox.spec.ts e2e/invoice-history-flow.spec.ts` | PASS, 2 tests | Cash close difference requires note; invoice void requires reason and row ActionMenu. |
| 2026-07-02 | `npm run lint` | PASS | Frontend lint. |
| 2026-07-02 | `npm run typecheck` | PASS | TypeScript no emit. |

Recharts emits a known Playwright/Vite console warning about chart container
dimensions in the mocked browser run. It does not currently fail the focused
gates, but it remains a visual/performance review item for final QA.

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

These commands are still required before final completion can be claimed:

```bash
docker compose up -d
docker compose exec backend php artisan migrate --seed
docker compose exec backend php artisan test
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
docker compose exec frontend npx playwright test
```

If any full-suite command is too slow or environment-bound, the blocker and the
latest focused substitute must be recorded in `docs/refactor-total-audit.md`.

## Backend Status

Backend full verification is not proven by this report. The final acceptance
criteria still require:

- `php artisan test`;
- `vendor/bin/pint --test`;
- `vendor/bin/phpstan analyse`;
- focused RBAC/idempotency/audit tests for critical actions.

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
