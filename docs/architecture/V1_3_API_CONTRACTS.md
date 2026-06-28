# V1.3 API Contracts

Status: initial inventory from `backend/routes/api.php` and `frontend/src/lib/api/**`.

## Contract Rules

- Backend remains source of truth for totals, ISV, paid state, fiscal numbering, receipt numbering, and permissions.
- Frontend may preview totals but cannot be the fiscal authority.
- Critical writes must use transactions and idempotency where duplicate submit can corrupt state.
- Contract changes require `docs/architecture/V1_3_CONTRACT_CHANGE_RECORD.md`.
- Backward compatibility is preferred when existing data/users could be affected.

## Current Contract Families

| Family | Backend Routes | Frontend Client | Initial V1.3 Notes |
| --- | --- | --- | --- |
| Auth/session | `/auth/login`, `/auth/session`, `/auth/me`, `/auth/change-password`, `/auth/logout` | `lib/api/auth.ts`, `LoginView`, `PasswordChangeView` | Review inactive/temporary password states and user-safe error mapping. |
| Settings/fiscal | `/settings/operational`, `/settings/fiscal`, `/fiscal-sequences`, logo/branding | `lib/api/fiscal.ts` | Setup status should feed dashboard and POS readiness. |
| Institutional receipts | `/settings/institutional-receipts/**`, `/institutional-receipts/**` | `lib/api/institutionalReceipts.ts` | Preserve institutional receipt as primary. Validate PDF/test-print/reprint contract. |
| Catalog | `/categories`, `/areas`, `/service-areas`, `/services` | `lib/api/catalog.ts`, catalog schemas | V1.3 defines `billing=1` as active + visible in billing + billable. Explicit `visible_in_billing` and `is_billable` filters are now backend-supported. |
| Billing/invoices | `/invoices`, `/invoices/{invoice}`, void/reverse | `lib/api/billing.ts`, `useInvoices`, POS reducer | Review payload shape for cashier-friendly POS and backend-total authority. |
| Payments | `/invoices/{invoice}/payments`, payment void routes | `lib/api/billing.ts`, `PaymentModal` | Ensure idempotency key is consistently supplied by frontend. |
| Cash sessions | `/cash-sessions/current`, open, close, index | `lib/api/cash.ts`, `useCashSession` | Review reconciliation shape, movements visibility, close-state UX. |
| Receipts legacy | `/invoices/{invoice}/receipt`, `/reprint` | `lib/api/billing.ts` | Decide relationship with institutional receipts; avoid primary receipt internal codes. |
| Reports | `/reports/dashboard`, today, executive, daily, monthly, income, categories, areas, services, operations, export/pdf | `lib/api/reports.ts` | Evaluate v2 pagination/sort/filter only if current endpoints limit tables. |
| Backups | `/backups`, `/backups/{backupLog}/download` | `lib/api/backups.ts` | Review status/log metadata and restore guidance. |
| System | `/system/status`, `/system/status-summary`, `/system/health`, setup/openapi/client-errors | `lib/api/system.ts` | Dashboard should surface LAN/offline/backup/setup health. |
| Admin users/roles | `/admin/users`, `/admin/roles` | `lib/api/users.ts` | RBAC/permission catalog contract needs admin table review. |

## Query Key Inventory

`frontend/src/lib/queryKeys.ts` has keys for categories, services, invoices, cash sessions, settings, fiscal sequences, reports, backups, system, and audit. V1.3 should normalize filter objects before query keys if cache churn appears in tables or report filters.

## Pending Contract Review Questions

1. Do report endpoints need a standard `{ data, meta, filters, totals }` envelope for table/report views?
2. Should dashboard v2 include cash state, backup alert, setup status, top services, and latest movement in one resource?
3. Should payment creation require/echo an operation id visible in audit but hidden from receipts?
4. Should invoice history expose receipt summary and payment status without N+1 detail calls?
5. Should receipt test preview/test print share one typed profile payload?
6. Should payment registration roll back when institutional receipt issuance fails, or create a formal receipt-pending recovery state?
7. Should zero-total dialysis-prescription erythropoietin invoices create a zero-amount payment method, use a separate waived state, or remain paid without payment?
8. Should `GET /institutional-receipts/{id}/pdf` be read-only while print events move exclusively to `POST /print-events`?

## Changed Contracts

### `/api/services` Billing Filters

Previous behavior: `billing=1` filtered `active=1` and `visible_in_billing=1`, while frontend also sent unsupported `is_billable=1`.

New behavior: `billing=1` filters `active=1`, `visible_in_billing=1`, and `is_billable=1`. Explicit `visible_in_billing` and `is_billable` boolean query parameters are validated and applied.

Reason: POS must not show services that invoice creation will reject.

Migration: none. Existing data is unchanged.

Compatibility: stricter POS/catalog billing lists; non-billable services remain queryable through explicit filters.

Tests: backend feature tests updated; frontend POS/catalog tests updated.
