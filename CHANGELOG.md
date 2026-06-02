# Changelog - Sistema de Caja Hospitalaria

## Unreleased - v1.0.0 Audit Plan (2026-06-02)

### Phase 7 - NewInvoiceView refactor (partial, behaviour-preserving)

- The 1020-line `NewInvoiceView.tsx` is split into dedicated modules so
  the cashier workflow can be unit-tested in isolation and the math
  (decimal handling, erythropoietin rule, tax estimate) stops being
  copy-pasted between the cart preview, the confirmation dialog and the
  success summary.
- `frontend/src/features/invoices/state/types.ts` exports `NewInvoiceState`,
  `NewInvoiceAction`, and `getInitialNewInvoiceState`.
- `frontend/src/features/invoices/state/reducer.ts` exports the pure
  `newInvoiceReducer` with a focused `addServiceToCart` helper.
- `frontend/src/features/invoices/state/posMath.ts` exports
  `parseQuantityUnits`, `parseLocalCents`, `formatCents`, `isZeroMoney`,
  `incrementQuantityFromString`, `parseTaxRateBasisPoints`,
  `effectiveUnitPriceCents`, and `computeSimpleEstimate`.
- Two new vitest suites cover the reducer (9 cases) and the POS math
  (10 cases), including the erythropoietin zero-amount path.
- `NewInvoiceView.tsx` drops to ~733 lines and now re-uses the same
  helpers the rest of the views will get in phase 8.

### Phase 8 - moneyCents wire across cashier UI

- `OpenSessionForm`, `ReceiptPreview`, `InvoiceConfirmation`,
  `CashSessionReportTab`, `IncomeReportTab`, `ServiceSalesTab`, and the
  catalog CSV importer of `SetupWizardDialog` now route money through
  `parseCents` / `formatCents` from `frontend/src/lib/moneyCents.ts`
  instead of `Number.parseFloat` / `Number(...)`.
- The cashier dashboard totals, reports, and the setup wizard CSV
  preview agree with the backend rounding rules.

### Phase 9 - apiClient hardening

- `frontend/src/lib/api/base.ts` now caches the `/sanctum/csrf-cookie`
  response for 30 minutes to avoid an extra round-trip on every mutating
  request.
- 422 validation errors expose the full field list (was truncated to the
  first three messages) with human-readable labels like
  `Items #2 (quantity): ...` and `patient name: ...`.
- New `isPermissionDeniedError(error)` helper alongside the existing
  `isSessionExpiredError(error)`.
- 423 Locked responses from the future lockout middleware get a dedicated
  safe message asking the operator to wait or request a supervisor
  reactivation.
- Tests in `frontend/src/lib/api/base.test.ts` cover CSRF caching, full
  422 list, 423, 403, 5xx sanitization, and the new helpers.

### Audit

- `docs/AUDIT_2026_06_02.md` records the full audit and the 20-phase
  plan to reach `PRODUCTION_READY`.

## v1.0.0-rc.2 - Production Audit Hardening (2026-06-01)

### What's New

12-phase audit-driven hardening pass. Each phase produced a
worklog under `worklogs/2026-06-01-audit-*.md` and a Conventional
Commit. Highlights:

- **F1**: Production defaults hardened — `DB_CONNECTION` now defaults
  to `mysql` instead of `sqlite`; queue `after_commit` enabled for
  database/beanstalkd/sqs/redis. New `ProductionConfigDefaultsTest`
  regression suite.
- **F2**: XSS hardening in `PdfExportService` — every user-controlled
  string (hospital name, RTN, payment method, status) is now escaped
  via a centralized `e()` helper using `htmlspecialchars(... ENT_QUOTES
  | ENT_HTML5, 'UTF-8')`. Five new vitest cases in
  `PdfExportEscapingTest`.
- **F3**: SQL float money math replaced with integer cents in
  `DashboardReportService` and `DailyReportService`. New
  `PaymentCentsSqlGuardTest` asserts no regression to
  `ROUND(payments.amount * 100)`.
- **F4**: Dead `app/Policies/*` removed. Five classes that were never
  registered with `Gate::policy()` are deleted, along with
  `CashRegisterSessionPolicy::viewAny/create` that returned `true`
  unconditionally (latent privilege escalation).
- **F5**: `2026_06_01_000001_add_amount_cents_to_payments_table`
  migration is now safe for SQLite via a driver-guarded backfill path
  and `Schema::hasColumn` re-entry guards. New
  `AmountCentsMigrationTest`.
- **F6**: `useBackups` TanStack Query hook hardened — derived
  `hasPending` and `pollIntervalMs` exposed; `keepPreviousData` and
  `staleTime: 30s` added. Three new vitest cases.
- **F7**: `NewInvoiceView` refactor deferred with rationale (see
  `worklogs/2026-06-01-audit-f7-newinvoice-deferred.md`).
- **F8**: New `frontend/src/lib/moneyCents.ts` — `parseCents`,
  `formatCents`, `parseQuantityUnits`, `formatQuantity` with
  8 vitest cases. Foundation for the next consolidation pass that
  will replace the per-view duplicates.
- **F9**: `apiClient.voidPayment(invoiceId, paymentId, reason)`
  exposed; new `PdfReportFilters` type; `downloadReportPdf` typed.
- **F10**: `setup.bat` no longer prints
  `--password=CAMBIAR_ESTA_CLAVE` on the command line. Operators are
  now instructed to set `HOSPITAL_INITIAL_ADMIN_PASSWORD` in their
  shell.
- **F11**: Docker compose for production — backend and nginx gained
  healthchecks; nginx now depends on backend `service_healthy`
  instead of `service_started`; `client_max_body_size` lowered from
  100M to 32M to match PHP `upload_max_filesize`.

### Quality Gates

| Gate | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Vitest | ✅ 94/94 (8 new) |
| PHPUnit | ✅ 254/254, 1717 assertions (10 new) |
| Pint | ✅ Passes |
| E2E | ✅ Existing pass (no regression) |

### Commits

- `4282c84` - fix(backend): harden production defaults for DB and queue
- `b66fc35` - fix(reports): escape pdf export html
- `5ea779f` - test(reports): cover pdf export html escaping
- `3346d1a` - fix(reports): prefer payments.amount_cents over SQL float round
- `16c6d70` - refactor(backend): remove dead policies in favor of form request authz
- `166106b` - fix(db): make amount_cents migration safe for non-mysql drivers
- `69d0d29` - refactor(frontend): harden useBackups hook with polling helper
- `ad1f1d1` - refactor(frontend): add moneyCents helpers for cart and payment math
- `46fa5bd` - refactor(frontend): expose voidPayment and add PdfReportFilters type
- `78e2735` - fix(ops): remove plaintext initial admin password from setup.bat
- `037548b` - fix(infra): add backend and nginx healthchecks, align body size

### Known Limitations

- NewInvoiceView (1020 lines, useReducer with 30+ actions) still
  inlined. Refactor deferred to v1.1.0.
- Frontend `parseCents`/`formatCents` are exported but not yet wired
  into the existing views. Migration is a v1.1.0 task.
- apiClient `base.ts` hardening (CSRF cache, localhost fallback
  feedback, full 422 list) still in scope for v1.1.0.
- Concurrent fiscal correlative test is not automated. The existing
  sequential test covers the SQL mechanics; the
  `qa/FINAL_CONCURRENCY_PROOF.md` manual run is still the source of
  truth.
- `phpstan` is not installed. `AGENTS.md` continues to list it as
  optional; the quality gate does not require it.

---

## v1.0.0-rc.1 - Phase 12 Final (2026-05-18)

### What's New

**POS Billing Workflow**
- 2-column layout: search/services left (internal scroll), sticky cart right
- Service cards with rich hover states and visible price badges
- Cart with item count badge and always-visible totals
- InvoiceSuccess with clear next actions (Cobrar ahora, Imprimir, Ver facturas)
- Cash session consistency across Dashboard, Sidebar, Topbar, and POS

**Components Migrated to shadcn/Radix**
- ReceiptPreview: NativeSelect replaced with Select component
- IncomeReportTab: 3 NativeSelect filters replaced with Select components

**Reports & Backups Hierarchy**
- ReportsView: clean shadcn/ui Tabs with KPIs at top
- BackupsView: summary cards (pending/success/failed) + filterable table
- FiscalSettingsView: organized into 4 tabs (Resumen/Hospital/Secuencia/Receipt)

### Quality Gates

| Gate | Status |
|------|--------|
| TypeScript | ✅ 0 errors |
| ESLint | ✅ 0 errors |
| Build | ✅ Passes (638KB gzip: 187KB) |
| Frontend Tests | ✅ 20/20 (3 consecutive runs) |
| Backend Tests | ✅ 124/124 |
| E2E | ✅ 2/2 |
| Laravel Pint | ✅ Passes |

### Known Limitations

- Print hardware validation (80mm/58mm) pending physical testing
- LAN client validation pending from another PC
- Production environment validation pending final server setup

---

## Previous Releases

See `docs/07_FINAL_PHASES_ROADMAP.md` for phase history.