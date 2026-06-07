# Current Architecture - Sistema de Caja Hospitalaria Offline

Last updated: 2026-05-22.

## System Shape

Sistema de Caja Hospitalaria is an offline LAN application:

- One local server PC runs Laravel, MySQL/MariaDB, the built React SPA and backup automation.
- Client PCs use a browser against the server IP or LAN hostname.
- Login, billing, payments, reports, receipts and backups must work without internet.
- Public web SEO is not a goal; browser/app identity and private LAN metadata are.

## Backend Boundaries

Laravel controllers are thin HTTP adapters. They should validate with Form Requests, authorize with permissions/policies/gates and delegate business rules to Actions or report services.

Main backend areas:

- `backend/app/Http/Controllers`: HTTP orchestration for auth, catalog, invoices, payments, cash sessions, receipts, reports, backups, users, fiscal settings and system status.
- `backend/app/Http/Requests`: validation contracts for write actions and report filters.
- `backend/app/Actions/Billing`: invoice totals, fiscal number reservation, invoice creation and voiding.
- `backend/app/Actions/Payments`: payment registration, invoice balance updates and cash movement creation.
- `backend/app/Actions/Cash`: open/close cashbox sessions.
- `backend/app/Actions/Receipts`: receipt data and audited reprint.
- `backend/app/Actions/Reports`: daily, income, category, service, cash session, dashboard and export services.
- `backend/app/Actions/Reports/Concerns/FormatsReportMoney.php`: report money parsing/allocation/formatting boundary.
- `backend/app/Support`: shared guards/search/status helpers such as invoice access and service search.

Rules to preserve:

- Invoice, payment, cash close, void and fiscal number operations are transactional.
- Historical invoices use snapshots in `invoice_items`; never recalculate history from mutable services.
- Money APIs return decimal strings. Authoritative report arithmetic uses cent helpers; floats are display/export boundary only.
- Cashier access to invoices/payments/reprints is scoped to own operational context unless elevated permissions are present.
- Backups are local files and queued jobs; restore is manual/documented, not a destructive UI button.

## Frontend Boundaries

React is organized by features, with shared UI primitives and API helpers:

- `frontend/src/App.tsx`: session/cash orchestration and shell composition.
- `frontend/src/AppRoutes.tsx`: private route mapping and permission gates.
- `frontend/src/layout`: app shell, sidebar and topbar.
- `frontend/src/components/ui`: reusable local shadcn-style primitives.
- `frontend/src/features/auth`: login and required password change.
- `frontend/src/features/dashboard`: dashboard summaries and charts. The dashboard route is lazy-loaded.
- `frontend/src/features/invoices`: POS, invoice history, receipt preview actions and invoice dialogs.
- `frontend/src/features/cash`: cashbox open/close/session summary.
- `frontend/src/features/catalog`: categories/services management and scanner codes.
- `frontend/src/features/reports`: report tabs, filters, tables, charts and export actions.
- `frontend/src/features/backups`: backup list, operational readiness and manual backup request.
- `frontend/src/features/settings`: fiscal identity, receipt width, logo and fiscal sequences.
- `frontend/src/features/admin`: user management.
- `frontend/src/features/help` and `frontend/src/features/onboarding`: offline operator guidance.

Rules to preserve:

- POS/cash routes stay eager and stable; dashboard can be lazy because it is not the critical cashier path.
- Frontend previews may help the operator, but backend remains source of truth for totals, tax, permissions and invoice status.
- Avoid visible implementation jargon in operator screens.
- Controls must be keyboard reachable and labeled; dialog focus behavior is protected by Playwright smoke tests.

## Build And Runtime Assets

- Vite builds static files into `frontend/dist`.
- Laravel serves the SPA routes and immutable `/assets/*` from that build.
- Laravel also serves `/manifest.webmanifest` and `/icons/*` from the build for LAN app identity.
- `robots.txt` disallows indexing because this is private/local software.
- No fonts, icons, metadata or app shell assets should require CDN/runtime internet.

## Quality Gates

Core automated gates:

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --colors=never
php artisan config:cache

cd C:\Projects\S_Hospital\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run e2e
```

Phase-specific gates recently added:

- `ReportMoneyArchitectureTest` protects report services from reintroducing float arithmetic.
- `ProductionSpaRouteTest` protects SPA routes, built manifest/icon routes, private metadata and `/up`.
- `production-readiness.spec.ts` protects cashier POS, receipt width, cash close accessibility and responsive navigation.

Physical gates still required for final production:

- Second PC LAN validation.
- Physical institutional receipt validation on media carta, carta and A5.
- Restore proof against a disposable MySQL/MariaDB database.
- Concurrency proof against the final MySQL/MariaDB/Laravel environment.
- Backup automation proof that manual backups move from `Pendiente` to `Protegido`.
