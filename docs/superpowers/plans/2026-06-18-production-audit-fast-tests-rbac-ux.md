# Production Audit, Fast Tests, RBAC and UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring S_Hospital from a strong production candidate to a defensible production-ready release by adding broad audit coverage, fast isolated backend tests, administrator-defined module access, complete flow QA, and focused UI/accessibility hardening.

**Architecture:** Keep Laravel as the source of truth for permissions, money, invoices, cash, receipts, backups and reports. Replace slow destructive test setup with a disposable MySQL/MariaDB golden database created from a migration hash, then clone it for test runs and isolate each test with transactions. Treat shadcn as an incremental component source because the project already has `components.json`, Radix, Tailwind, lucide and local UI primitives.

**Tech Stack:** Laravel 12, PHPUnit, MySQL/MariaDB, Docker Compose, React 19, TypeScript, Vite, Vitest, Playwright, TanStack Query, React Hook Form, Zod, Radix/shadcn-style components, Tailwind v4.

---

## Scope Boundaries

- No `migrate:fresh`, `db:wipe`, `docker volume rm`, or destructive migration commands against production or the current LAN database.
- Production database remains untouched except for explicitly approved incremental migrations after backup.
- The golden database is only for test databases whose names contain `test`, `testing`, `golden`, or an explicit generated run id.
- Roles may remain as templates, but the administradora decides module permissions per user.
- No UI library bulk overwrite. shadcn additions must be previewed with `--dry-run` or `--diff` and reviewed file by file.

## Target Files

- Create: `backend/app/Support/Testing/MigrationHash.php`
- Create: `backend/app/Console/Commands/PrepareGoldenTestDatabaseCommand.php`
- Create: `backend/tests/Support/FastRefreshDatabase.php`
- Create: `backend/tests/Feature/Testing/GoldenDatabaseCommandTest.php`
- Create: `scripts/run_backend_tests_fast_mysql.ps1`
- Create: `scripts/run_backend_tests_fast_mysql.sh`
- Modify: `backend/tests/TestCase.php`
- Modify: `backend/phpunit.xml`
- Modify: backend tests that currently import `Illuminate\Foundation\Testing\RefreshDatabase`
- Modify: `backend/database/seeders/RolesAndPermissionsSeeder.php`
- Modify: `backend/app/Http/Controllers/UserController.php`
- Modify: `backend/app/Http/Requests/Admin/StoreUserRequest.php`
- Modify: `backend/app/Http/Requests/Admin/UpdateUserRequest.php`
- Modify: `backend/tests/Feature/UserManagementTest.php`
- Modify: `backend/tests/Feature/PermissionAuditTest.php`
- Modify: `frontend/src/lib/api/types.ts`
- Modify: `frontend/src/lib/api/users.ts`
- Modify: `frontend/src/features/admin/UsersView.tsx`
- Modify: `frontend/src/features/admin/UsersView.test.tsx`
- Create: `frontend/e2e/admin-permissions.spec.ts`
- Create: `frontend/e2e/all-buttons-smoke.spec.ts`
- Create: `qa/production-audit/README.md`
- Create: `qa/production-audit/button-smoke-report.json`
- Modify: `docs/DECISIONS.md`
- Modify: `docs/PERMISSIONS_MATRIX.md`
- Modify: `docs/RELEASE_CHECKLIST.md`

## Phase 0: Baseline and Safety Snapshot

**Purpose:** Lock current evidence and prevent accidental data loss.

- [ ] Run `git status --short` and record dirty state in `qa/production-audit/README.md`.
- [ ] Run `docker compose -p shospital_offlinetest -f docker-compose.prod.yml --env-file C:\tmp\s_hospital_offlinetest.env ps` and record container status.
- [ ] Run the existing elevated preflight if admin is available, but do not edit production data.
- [ ] Confirm the only known non-code production blocker is physical paper validation in `qa/INSTITUTIONAL_RECEIPT_PRINT_PROOF.md`.
- [ ] Commit scope only after user approval.

**Verification:**

```powershell
git status --short
docker compose -p shospital_offlinetest -f docker-compose.prod.yml --env-file C:\tmp\s_hospital_offlinetest.env ps
```

**Acceptance:** No destructive command was executed and the baseline file names the exact remaining blockers.

## Phase 1: Golden MySQL/MariaDB Test Database

**Purpose:** Stop paying migration cost for every test run while keeping tests isolated and safe.

- [ ] Add `MigrationHash` to hash migration filenames and contents plus seeders that define base roles/permissions.
- [ ] Add `testing:prepare-golden-database` command with guards:
  - refuses `APP_ENV=production`;
  - refuses database names that do not match `test|testing|golden`;
  - refuses host `mysql`/LAN production unless `HOSPITAL_TEST_DB_STRATEGY=golden_mysql`;
  - creates template dump under `backend/storage/framework/testing/golden/<hash>.sql`;
  - creates a fresh clone database named `s_hospital_test_<hash>_<pid>`.
- [ ] Add `Tests\Support\FastRefreshDatabase`:
  - uses Laravel `RefreshDatabase` normally for SQLite/in-memory;
  - for `golden_mysql`, begins a transaction before each test and rolls back after each test;
  - clears Spatie permission cache between tests;
  - never calls `migrate:fresh` in golden mode.
- [ ] Mechanically replace test imports:

```php
use Illuminate\Foundation\Testing\RefreshDatabase;
```

with:

```php
use Tests\Support\FastRefreshDatabase as RefreshDatabase;
```

- [ ] Add Windows and Bash runners that prepare the golden clone and then run:

```powershell
php artisan test
```

with env:

```text
APP_ENV=testing
DB_CONNECTION=mysql
HOSPITAL_TEST_DB_STRATEGY=golden_mysql
```

- [ ] Keep current SQLite test path as fallback.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --filter=GoldenDatabaseCommandTest
powershell -NoProfile -ExecutionPolicy Bypass -File ..\scripts\run_backend_tests_fast_mysql.ps1 -Filter=UserManagementTest
php artisan test --filter=SystemStatusTest
```

**Acceptance:** The fast MySQL runner creates/clones only disposable test databases, runs selected tests without `migrate:fresh`, and leaves the production database untouched.

## Phase 2: Administrator-Defined Module Access

**Purpose:** Let the administradora decide which modules each user can access instead of hardcoding a single role as the final authority.

- [ ] Keep roles as starting templates: `admin`, `supervisor`, `auditor`, `soporte_tecnico`, `cajero`.
- [ ] Expose grouped module permissions from backend:
  - `billing`: `invoices.view`, `invoices.create`, `invoices.void`, `invoices.reverse`
  - `cash`: `cash.view`, `cash.open`, `cash.close`, `cash.close_any`, `payments.create`, `payments.view`, `payments.void`
  - `receipts`: `receipts.view`, `receipts.reprint`, `receipts.reprint_any`, `receipts.void`, `receipts.print_test`
  - `catalog`: `catalog.view`, `catalog.manage`
  - `reports`: `reports.view`, `reports.managerial.view`, `reports.cash_session.view`, `reports.export`
  - `settings`: `settings.fiscal.view`, `settings.fiscal.update`, `receipt_settings.view`, `receipt_settings.update`
  - `users`: `users.view`, `users.create`, `users.update`, `users.disable`, `users.assign_admin_role`
  - `backups`: `backups.view`, `backups.create`, `backups.download`
  - `audit`: `audit.view`, `system.status.view`
- [ ] Change user create/update payload from `role` only to:

```json
{
  "role": "cajero",
  "permissions": ["invoices.create", "cash.open", "payments.create"]
}
```

- [ ] Backend sync behavior:
  - assign selected role;
  - sync direct permissions selected by the administradora;
  - reject assigning `users.assign_admin_role` or role `admin` unless actor has `users.assign_admin_role`;
  - reject actor removing their own admin/user-management permissions;
  - audit old/new roles and permissions.
- [ ] Frontend `UsersView` becomes a module-access screen:
  - role selector applies a template;
  - module checkboxes/toggles decide final access;
  - dangerous permissions show confirmation;
  - empty permissions are blocked unless user is inactive.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --filter=UserManagementTest
php artisan test --filter=PermissionAuditTest
cd ..\frontend
npm run test -- UsersView --run
npm run typecheck
```

**Acceptance:** An admin can create a cashier with exactly selected modules, backend enforces the selected permissions, and audit logs record permission changes.

## Phase 3: Critical Flow Test Matrix

**Purpose:** Cover every business-critical flow with automated tests and close button/action gaps.

- [ ] Backend feature tests must cover:
  - login/logout/session/401/403;
  - open/close cash session;
  - invoice creation with closed/open cash behavior;
  - payment overpay rejection;
  - partial payments and balance;
  - void payment and reverse invoice;
  - institutional receipt issue/reprint/PDF;
  - reports totals vs payments/cash;
  - backup create/download metadata;
  - admin permission matrix.
- [ ] Frontend Vitest must cover:
  - forms validation;
  - loading/empty/error states;
  - disabled buttons during submit;
  - modal cancel/confirm paths;
  - 401/403 user messages;
  - dark/light state tokens for critical badges.
- [ ] Playwright must cover:
  - login;
  - dashboard;
  - open cash;
  - new invoice;
  - payment;
  - receipt preview/download;
  - history reprint with required reason;
  - reports export controls;
  - backups UI state;
  - users module-access edit.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --filter=Cash
php artisan test --filter=Invoice
php artisan test --filter=InstitutionalReceipt
cd ..\frontend
npm run test:critical
npm run test:e2e
```

**Acceptance:** Every critical button and workflow has at least one automated assertion, and failures show actionable messages.

## Phase 4: shadcn/UI Integration and UX Hardening

**Purpose:** Improve consistency and accessibility without destabilizing fiscal/cash logic.

- [ ] Run:

```powershell
cd C:\Projects\S_Hospital\frontend
npx shadcn@latest info --json
```

- [ ] Inventory current `frontend/src/components/ui` and avoid re-adding components already present.
- [ ] For each missing component, use dry-run/diff first:

```powershell
npx shadcn@latest add tooltip skeleton separator alert --dry-run
```

- [ ] Add only components that reduce custom duplicated UI:
  - `Tooltip` for icon-only buttons;
  - `Skeleton` for loading tables;
  - `Alert` for errors/warnings;
  - `Separator` where raw borders are repeated.
- [ ] Do not overwrite existing local components without explicit approval.
- [ ] Refactor icon-only buttons to have:
  - stable size;
  - accessible name;
  - tooltip;
  - no raw icon color unless semantic token exists.
- [ ] Refactor high-risk forms to use consistent field/error pattern:
  - users;
  - cash close;
  - new invoice payment modal;
  - receipt settings;
  - fiscal settings.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\frontend
npm run test:critical
npm run lint
npm run typecheck
npm run build
```

**Acceptance:** UI improvements are incremental, accessible, tested, and do not replace the established design system in one risky sweep.

## Phase 5: Full Button, Accessibility and Visual Smoke

**Purpose:** Prove screens do not just render; their actions are reachable and named.

- [ ] Add Playwright button smoke:
  - enumerate visible buttons/links/menuitems on each main page;
  - assert each has accessible name;
  - click safe non-mutating actions;
  - for mutating actions, assert confirmation modal appears and can cancel.
- [ ] Add axe scan for:
  - login;
  - dashboard;
  - new invoice;
  - cashbox;
  - catalog;
  - history;
  - reports;
  - backups;
  - settings;
  - users.
- [ ] Add mobile viewport run for the same pages.
- [ ] Save report to `qa/production-audit/button-smoke-report.json`.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\frontend
npx playwright test e2e/all-buttons-smoke.spec.ts
npm run visual:smoke
```

**Acceptance:** No unnamed controls, no broken cancel paths, no fatal console errors, and no mobile/tablet overflow on main screens.

## Phase 6: Performance and Operator Experience

**Purpose:** Make the system feel fast for the administradora/cajera, not only correct.

- [ ] Backend:
  - verify indexes for report/history filters;
  - add tests around report query bounds;
  - prevent unbounded exports without date range;
  - cache active catalog with invalidation on catalog update.
- [ ] Frontend:
  - set TanStack Query `staleTime` for catalog/settings where safe;
  - avoid refetch storms after payment/receipt;
  - ensure every submit has disabled/loading state;
  - ensure 401 routes to login and 403 shows permission message.
- [ ] Add performance baseline docs from local LAN:
  - dashboard load;
  - search service;
  - create invoice;
  - register payment;
  - open receipt PDF;
  - reports refresh.

**Verification:**

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --filter=ReportPerformanceBaselineTest
cd ..\frontend
npm run test:critical
npm run build
```

**Acceptance:** Critical flows stay responsive on local LAN and report/export operations are bounded.

## Phase 7: Final Production Gate

**Purpose:** Prove the release is ready except for explicitly external physical evidence.

- [ ] Run backend fast MySQL suite.
- [ ] Run frontend critical/full suite.
- [ ] Run Playwright E2E.
- [ ] Run restore proof against disposable MariaDB/MySQL.
- [ ] Run concurrency proof against local test target.
- [ ] Run elevated preflight.
- [ ] Keep physical printer validation separate and factual:
  - if no printer exists, status remains blocked;
  - if printer exists, attach photos/acta for media carta/carta/A5.

**Verification:**

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_backend_tests_fast_mysql.ps1
cd frontend
npm run test:full:windows
npm run test:e2e
cd ..
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\production_readiness_preflight.ps1 -BaseUrl http://192.168.1.7:8081 -EnvFile C:\tmp\s_hospital_offlinetest.env -ComposeProjectName shospital_offlinetest
```

**Acceptance:** `PRODUCTION_READY` is blocked only by true external hardware evidence, not by code/test/permissions/UX gaps.

## Plan Review Summary

**Decision:** APROBADO CON CAMBIOS.

| Reviewer | Severity | Finding | Required Change |
| --- | --- | --- | --- |
| Architecture | Alta | Replacing the whole UI stack with shadcn would risk regressions. | Use shadcn incrementally with dry-run/diff only. |
| Database | Bloqueante | A fast test DB must never clone or wipe production. | Add database-name/env guards before any clone/import. |
| Security | Alta | Roles alone do not satisfy administrator-defined module access. | Add direct user permissions with audit and self-lockout protection. |
| QA | Alta | Button smoke must distinguish safe clicks from mutating actions. | Mutating buttons only open/cancel confirmation in smoke tests. |
| Offline Ops | Media | Printer validation cannot be faked with virtual PDF printers. | Keep physical paper proof as external gate. |

## Execution Order

1. Phase 0: baseline and safety.
2. Phase 1: golden test database.
3. Phase 2: administrator-defined module access.
4. Phase 3: critical flow test matrix.
5. Phase 4: shadcn/UI incremental integration.
6. Phase 5: full button/a11y/visual smoke.
7. Phase 6: performance/operator experience.
8. Phase 7: final production gate.

## Commit Plan

- `test(backend): add golden mysql test database runner`
- `feat(admin): allow module-level user permissions`
- `test(qa): cover critical hospital workflows`
- `feat(ui): add focused shadcn primitives`
- `test(e2e): add button and accessibility smoke`
- `perf(app): tighten report and catalog performance`
- `test(release): run final production gate`

