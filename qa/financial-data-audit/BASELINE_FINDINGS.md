# Financial Data Audit Baseline - 2026-05-31

## Purpose

This packet records the starting point for the financial data integrity front.
It is evidence for planning and later comparison, not a product change.

## Current Runtime

Checked with:

```powershell
docker compose ps
docker compose exec -T backend php artisan migrate:status
```

Observed services:

- `backend`: up on `http://localhost:8000`
- `frontend`: up on `http://localhost:5173`
- `mysql`: MariaDB 11 healthy, host port `3307`

Observed migrations:

- All current Laravel migrations are marked `Ran`.
- No new migrations were applied in this phase.

## Current Database Counts

Checked with read-only SQL through the MariaDB container.

| Table | Count |
|---|---:|
| `users` | 0 |
| `fiscal_settings` | 0 |
| `fiscal_sequences` | 0 |
| `categories` | 0 |
| `services` | 0 |
| `invoices` | 0 |
| `payments` | 0 |
| `cash_register_sessions` | 0 |
| `audit_logs` | 0 |

Finding: the current development database has schema but no operational data.
This blocks authenticated browser review and makes the current database
unusable as evidence for real totals until it is safely seeded, restored, or
connected to the intended validation database.

Risk: a financial system must not let routine test or validation commands wipe
the operator's working database. Before later phases run destructive commands,
the workflow needs an explicit disposable database or a verified backup.

## Browser Evidence

Scripts:

- `qa/financial-data-audit/capture-current-ui.mjs`
- `qa/financial-data-audit/probe-current-api.mjs`

The scripts require:

- `FINANCIAL_AUDIT_USER`
- `FINANCIAL_AUDIT_PASSWORD`

Current capture result:

- `qa/financial-data-audit/capture-current-ui.json` shows login did not reach
  the authenticated app shell.
- `qa/financial-data-audit/probe-current-api.json` shows authenticated endpoints
  returning `401 Unauthenticated` after login failed.

This is expected with the current DB state because `users` is empty. The next
phase must not hide this by using hardcoded demo credentials.

## Prior UI/API Mismatches Observed Before The DB Became Empty

Earlier local evidence from the same audit front showed:

- Reports UI rendered `Saldo pendiente: L. undefined`.
- `/api/reports/daily?date=2026-05-31` returned billed, collected, payment
  method totals, invoice counts, and status totals, but no explicit pending
  amount field.
- Catalog UI showed `0 servicios` and skeleton rows while the API returned
  `total: 122` services.
- Relative `/api/*` requests through the Vite container proxy returned 500 when
  the proxy target resolved `localhost:8000` from inside the frontend container.
  Direct calls to `http://localhost:8000` worked.

These remain valid design inputs for Phase 1 because they expose a missing
financial facts contract and brittle frontend/API runtime assumptions.

## Financial Integrity Gaps To Address

1. Daily/range reports need explicit fields for `facturado`, `cobrado`,
   `pendiente`, `parcial`, and `anulado`.
2. Partial invoices must never be counted as paid.
3. Void invoices must be shown separately and excluded from income.
4. Card, transfer, and other non-cash payments must never increase expected
   cash.
5. Cash close reports must preserve counted cash, expected cash, difference,
   method totals, pending balance, cashier, and timestamp.
6. Payment reversals need append-only audit metadata; payments must not be
   deleted.
7. Catalog data needs area, aliases, visibility, billability, duplicate
   prevention, and price history.
8. Receipt reprint must use invoice and item snapshots, never current catalog
   prices or current fiscal settings.
9. Exported reports must not expose technical ids, internal codes, stack traces,
   or raw JSON.
10. The quality gate must prove the backend test suite can run without touching
    the local MariaDB development data.

## Verification Baseline

Current known status from this Phase 0 run:

- Frontend `typecheck`: passed.
- Frontend `lint`: passed.
- Frontend `test`: passed, with React `act(...)` warnings and duplicate key
  warnings.
- Frontend `build`: passed, with a Vite chunk-size warning.
- Backend `ReportsTest`: passed.

Known unresolved baseline risks:

- Full backend test suite timed out in an earlier baseline run and must be
  investigated before final completion.
- Branding check inside the Linux frontend container failed earlier because
  `powershell` is unavailable there.

Do not treat the current front as complete until these checks are rerun after
the implementation phases and their scope is confirmed.

## Safe Next Step

Proceed with Phase 1 only after acknowledging that the current MariaDB database
is empty. If runtime screenshots are required before Phase 1, create a temporary
validation user and seed catalog data in a documented, reversible development
environment, or restore from a known backup after explicit approval.
