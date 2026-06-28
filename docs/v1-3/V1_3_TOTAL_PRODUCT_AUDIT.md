# V1.3 Total Product Audit

Status: initial controller audit, pending subagent handoffs.
Date: 2026-06-28.
Base: `origin/main` at `e08f0e9d7bf740bcf10b7d0b036f6b05980acb42`.

## Base Decision

`origin/codex/v1-2-full-ux-ui-redesign` exists at `c7a35a8a` and contains useful UI work. It is not used as the direct base because its diff from `origin/main` includes more than 1,500 files and reintroduces agentic artifacts, prompts, local skills, screenshots, and generated documents that `main` intentionally cleaned. V1.3 starts from `origin/main` and will recover useful V1.2 product ideas selectively.

## System Snapshot

- Backend: Laravel API with Form Requests, Policies, Services/Actions, Sanctum/web session routes, idempotency middleware on critical write routes.
- Frontend: React 19, TypeScript, Vite, Tailwind v4, Radix wrappers, TanStack Query, React Hook Form, Zod, Recharts.
- Data: MySQL/MariaDB target with invoice/payment/cash/receipt/report migrations and tests present.
- Offline/LAN: runtime target remains `http://192.168.1.10:8081`; no cloud service should be required for daily operation.

## Cross-Cutting Findings

| Area | Problem | Impact | Solution | Contract | Risk | Priority | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Baseline backend | Host lacks `composer`; Docker compose requires local env variables. | Host backend gates cannot run directly; Docker path is usable. | Keep Docker as the verification path and document env bootstrap. | No | Medium | P0 | `php artisan test`, migrate/seed in Docker. |
| V1.2 reuse | V1.2 has useful UI but also obsolete artifacts. | Direct base would regress repository hygiene. | Cherry-pick or manually port only frontend/product improvements. | No | Medium | P0 | Git diff review, frontend gates after port. |
| Performance | Build shows `charts` 398.35 kB and `vendor` 348.15 kB chunks. | Slow first load on modest LAN PCs if not managed. | Lazy-load heavy analytics, avoid extra chart/table libs unless justified. | No | Medium | P1 | Build size report, Playwright smoke, LAN performance review. |
| Documentation | Cleaned `main` has no `docs/` tree. | Phase records absent unless recreated. | Create V1.3 docs as first-class tracked artifacts. | No | Low | P0 | Review docs in final report. |
| Receipt issuance after payment | Payment can succeed while institutional receipt issuance reports an error. | Paid invoices can exist without principal institutional receipt. | Decide mandatory atomic payment+receipt rollback vs explicit receipt-pending recovery queue. | Yes if changed | High | P1 | Payment/receipt feature tests, frontend recovery tests. |
| Critical mutation idempotency | Frontend generated fresh keys for manual payment retries. | Partial payment retry after timeout could double-apply. | V1.3 now supports stable POS payment keys; still needs timeout refetch policy. | No | High | P1 | Payment retry tests, double-payment feature tests. |

## Module Audit Matrix

| Module | Initial Problem | Impact | Proposed Solution | Contract | Risk | Priority | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login | Needs final review for lockout, inactive users, first password change, LAN error messaging. | Cashier may be blocked by unclear states. | Audit `AuthController`, LoginView, lockout tests; improve state copy and denied flows if needed. | Maybe | Medium | P1 | Auth feature tests, LoginView, a11y. |
| Password change | Must remain mandatory for temporary passwords. | Weak setup hygiene if bypassed. | Verify middleware and UI flow under inactive/expired states. | No | Medium | P1 | Auth tests, route tests. |
| Dashboard | Current route exists, charts present; operational "next action" needs product-grade review. | Supervisors need immediate state of cash, sales, backups, setup. | Dashboard v2 may aggregate cashbox, status, top services, backups, setup flags. | Maybe | Medium | P1 | Dashboard service tests, frontend tests. |
| Billing/POS | Existing reducer and components present; must be simpler for cashiers and keyboard-first. Patient whitespace, stale cash session, POS billable filtering and auto-payment permission P1s were fixed in V1.3. | Slow billing and cashier mistakes. | Split patient/search/cart/totals/action dock, preserve backend totals as truth. Decide zero-total invoice semantics. | Maybe | High | P0 | InvoiceCreation, reducer, POS E2E. |
| Payment modal | Critical path with idempotency and double-submit risk. POS payment key support was added in V1.3. | Duplicate or wrong payment can corrupt cash. | Add timeout/refetch recovery before allowing manual retry. | Maybe | High | P0 | DoublePayment, RegisterPayment, modal tests. |
| Invoice confirmation | Needs clear receipt/PDF/reprint path and caja association. | Paid invoice may not be easy to print/reprint. | Confirmation should expose institutional receipt first, thermal secondary. | Maybe | Medium | P1 | InstitutionalReceipt flow tests. |
| Invoice history | Existing paginated endpoint and table exist; duplicate manual receipt generation guard fixed. Still lacks detail drawer and cashier/session filters. | Supervisors cannot audit/reprint quickly. | DataTable v2, drawer, status, payment/receipt actions. | Maybe | Medium | P1 | Invoice history tests, E2E. |
| Cashbox | Sessions/open/close/movements exist; reconciliation UX must be field-proof. | Cash close errors and unclear discrepancy handling. | Cash state panel, close checklist, movement audit trail. | Maybe | High | P0 | Close cash session, reconciliation tests. |
| Reports | Many endpoints exist. Executive preset desync and 92-day frontend range mismatch fixed. Audit 403 isolation and table scalability remain. | Reports may be powerful but hard to scan/export. | Adopt TanStack Table only for report/history/admin tables if it reduces custom table risk. | Maybe | Medium | P1 | Report tests, export tests, visual. |
| Catalog | Services/categories/areas exist with tests. POS billable filter, visible/billable edit flags, and barcode/QR persistence fixed. | Pricing or area errors affect billing. | Professional table filters, active state, price audit visibility. Resolve area model drift. | Maybe | Medium | P1 | ServiceCatalog tests, catalog UI tests. |
| Backups | API/actions/tests exist; Docker/env state needs operator clarity. | Field operators need confidence and restore guidance. | Backup status panel with logs, warnings, manual backup, restore instructions. | Maybe | High | P1 | BackupWorkflow, UI tests. |
| Fiscal settings | Existing fiscal/sequence/logo routes. | Bad fiscal setup blocks compliant invoices. | Strong setup status, validation summaries, only configured legal fields. | Maybe | High | P0 | FiscalSettings tests. |
| Receipt settings | Receipt series/profiles/events exist. | Primary receipt must be formal and not expose internal codes/QR/barcode. | ReceiptDocumentFrame, print preview profiles, PDF proof. | Maybe | High | P0 | InstitutionalReceiptPdfTest, preview tests. |
| Users/RBAC | Users/roles/controllers/policies exist. | Permission mistakes affect voids/backups/admin. | Permission matrix UI, denied states, active/inactive, reset password flow. | Maybe | High | P0 | RBAC/IDOR tests, UsersView tests. |
| Support/about/help | Present; must not replace operational UX. | Help can become clutter. | Keep concise field guidance and status summaries. | No | Low | P2 | Support tests. |
| 404/access denied | Present routes need UX review. | Operators need clear recovery paths. | Standard ErrorState v2 with allowed actions. | No | Low | P2 | App route tests. |
| Shell/nav | Existing AppShell/sidebar/topbar/mobile nav. | Main workflows must be fast and scannable. | AppShell v2 with workflow rail, command center if justified. | Maybe | Medium | P1 | AppShell tests, visual. |
| Mobile | Tests/screens exist; must be usable at 320/375. | Field tablets/phones need emergency usability. | Bottom action bar, stable dimensions, no overflow. | No | Medium | P1 | v1-3 responsive visual spec. |
| Dark mode | Tokens exist but need professional contrast and receipt print isolation. | Supervisors may use dark mode; print must stay formal. | Dark tokens, focus ring, print tokens independent from dark theme. | No | Medium | P2 | A11y visual tests. |

## Acceptance Criteria For Code Phase

- No production code change without matching focused tests for touched risk.
- Backend remains source of truth for money/totals.
- Critical writes keep DB transactions and idempotency where applicable.
- Paid invoice remains associated to cash session, cashier, payment method, and date.
- Void/reverse requires permission, reason, and audit.
- Receipt primary profile is institutional paper/PDF; 80mm/58mm remain secondary.
- No QR/barcode/internal codes on the primary institutional receipt.

## V1.3 Fix Verification To Date

- `npm run test -- src/lib/api/billing.test.ts src/features/invoices/NewInvoiceView.test.tsx`: PASS, 23 tests.
- `npm run test -- src/features/catalog/components/ServiceSheet.test.tsx src/features/reports/ReportsView.test.tsx src/features/invoices/InvoiceHistoryView.test.tsx`: PASS, 39 tests.
- `npm run typecheck`: PASS after fixes.
- `npm run lint`: PASS after fixes.
- `docker compose run --rm backend composer install --no-interaction --no-progress`: PASS.
- `docker compose run --rm backend vendor/bin/pint --test`: PASS, 403 files.
- `docker compose run --rm backend php artisan test --filter='InvoiceCreationTest|ServiceCatalogTest' --colors=never`: PASS WITH WARNINGS, 57 tests and 303 assertions. Warnings are repeated `file_get_contents(/var/www/html/.env)` because the container lacks an ignored `.env` file.
- `docker compose run --rm backend php artisan test --colors=never`: INCONCLUSIVE, timed out after 4 minutes without useful output.
