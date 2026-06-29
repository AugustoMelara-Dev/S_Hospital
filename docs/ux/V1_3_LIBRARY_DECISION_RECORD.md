# V1.3 Library Decision Record

Status: refreshed after syncing `codex/v1-3-total-product-refactor` with current `origin/main`.
Local review date: 2026-06-28.

## Baseline

- Base SHA: `742fdb551b202ddb0473a0269440e0bf6ff116ce`.
- Branch SHA after base sync: `b4b5fdcee0bab9a654dd60a47ae613059e71d766`.
- Current verification:
  - `pnpm run typecheck`: PASS.
  - `pnpm run lint`: PASS.
  - `pnpm exec vitest run src/features/invoices/NewInvoiceView.test.tsx --pool=forks --maxWorkers=1 --no-file-parallelism --testTimeout=30000`: PASS, 22 tests.
  - `pnpm run test`: PASS, 83 files and 498 tests.
- Docker baseline blocked in this shell by missing required environment variable `DB_PASSWORD` for `docker compose ps`.
- No production dependency was added during this refresh.

## Current Dependency Position

| Library | Decision | Reason | Bundle/Offline Impact | Tests Required |
| --- | --- | --- | --- | --- |
| `@tanstack/react-table` | USE THROUGH LOCAL WRAPPER | Already installed and used by `frontend/src/components/ui/data-table.tsx`. Strong fit for professional catalog, report, history, users, and backups tables. | No new dependency. Central wrapper should reduce table duplication and improve consistency. | DataTable unit tests, per-module table tests, report/history/admin E2E. |
| `@tanstack/react-virtual` | DEFER | No current dependency or usage. Add only after measured row counts or Playwright/performance evidence show rendering pressure. | Avoids extra runtime and complexity for modest LAN PCs. | Large-row rendering benchmark, performance review, focused table tests. |
| `cmdk` | DEFER | Command palette/global search may help navigation, but cashier POS actions are higher priority and current shell does not prove need. | Avoids another command/menu abstraction. Offline-compatible if added later. | Keyboard/a11y tests, navigation E2E, cashier workflow test. |
| `react-aria-components` | DEFER | Radix already covers current primitive needs. Add only for a specific complex interaction Radix cannot cover cleanly. | Larger component API surface. | Component a11y tests and interaction tests for the exact primitive. |
| `ariakit` | DEFER | Same class as React Aria; do not mix primitive systems unless a specific blocker appears. | Extra primitive system risk. | Same as above. |
| `date-fns` | DEFER | No current dependency. Use only if report/fiscal date range handling keeps duplicating or drifting. | Manageable, but unnecessary without evidence. | Date preset/range tests, report filter tests, timezone boundary tests. |
| `zod` | KEEP | Already installed for frontend schema validation. Keep frontend validation as UX guard, not fiscal truth. | Existing dependency. | Form schema tests and API error handling tests. |
| `Recharts` | KEEP | Already installed and used in dashboard/reports. Avoid chart suite migration. | Existing chart chunks need performance review before adding more chart weight. | Chart rendering tests, responsive visual smoke, build size review. |
| shadcn/ui patterns | USE AS LOCAL PATTERN | Works with Tailwind, Radix, TanStack Table, and local component ownership. | No runtime SaaS/cloud dependency. Copy/adapt local code only. | Component tests, a11y checks, visual review. |

## Rejected Without New Evidence

- MUI.
- Ant Design.
- Chakra.
- Bootstrap.
- Heavy animation libraries.
- Alternative heavy chart suites.

## Dependency Addition Rule

Before adding any dependency in V1.3:

1. Record the product problem and why current code cannot solve it safely.
2. Confirm offline/LAN runtime compatibility.
3. Install with the project package manager (`pnpm` in the frontend).
4. Run `pnpm audit` or the closest available audit gate.
5. Run `pnpm run typecheck`.
6. Run `pnpm run lint`.
7. Run `pnpm run test`.
8. Run `pnpm run build`.
9. Document bundle impact in this file and in `docs/qa/V1_3_PERFORMANCE_LAN_REVIEW.md`.
