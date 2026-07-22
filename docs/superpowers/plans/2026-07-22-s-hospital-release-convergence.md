# S_Hospital Release Convergence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a fast, human, visually restrained and release-certifiable S_Hospital without changing its single-hospital offline-LAN architecture.

**Architecture:** Preserve Laravel + React and converge presentation through shared error, table, receipt and export contracts. Fix query behavior at the API/database boundary, keep immutable fiscal snapshots, and validate each vertical slice with red-green TDD plus real Docker/MariaDB flows.

**Tech Stack:** Laravel 12, PHP 8.3, MariaDB 11, React 19, TypeScript 5.9, TanStack Query/Table, shadcn/Radix, Tailwind 4, DomPDF, PhpSpreadsheet, Vitest, Testing Library and Playwright.

## Global Constraints

- Single hospital only; no multitenancy, SaaS or internet runtime dependency.
- Preserve invoice, payment, cash, permission, audit and fiscal history rules.
- Do not expose HTTP methods, API paths, SQL, exceptions, queue names or filesystem paths in operational UI.
- Selecting `Todas` must show at least 10 billable services when at least 10 exist.
- Receipt preview, issued receipt, history, PDF and print share one monochrome hierarchy.
- No production behavior change without a failing test first.
- Each task ends in a focused Conventional Commit.

---

### Task 1: Human-safe language and error boundary

**Files:**
- Modify: `frontend/src/lib/api/errors.ts`
- Modify: `frontend/src/app/operationalStatus.ts`
- Modify: `frontend/src/design-system/components/InstitutionalIdentity.tsx`
- Modify: `frontend/src/features/auth/LoginView.tsx`
- Test: `frontend/src/lib/api/errors.test.ts`
- Test: `frontend/src/app/operationalStatus.test.ts`
- Test: `frontend/src/design-system/components/InstitutionalIdentity.test.tsx`
- Test: `frontend/src/features/auth/LoginView.test.tsx`

**Interfaces:**
- Produces: `userSafeErrorMessage(error: unknown, fallback: string): string` that always strips request internals.
- Produces: identity copy with an administrative setup hint only where action is possible.

- [ ] **Step 1: Write failing tests**

```ts
it('never exposes request method or API path', () => {
  expect(userSafeErrorMessage(new Error("La operación 'GET /api/invoices?page=1' excedió 10s"), 'No se pudo cargar.'))
    .toBe('La respuesta está tardando más de lo esperado. Intente nuevamente.');
});

it('uses direct hospital access copy', () => {
  render(<LoginView onSubmit={vi.fn()} />);
  expect(screen.getByText('Acceso seguro')).toBeVisible();
  expect(screen.queryByText(/infraestructura|módulos autorizados/i)).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test -- errors operationalStatus InstitutionalIdentity LoginView --pool=forks --maxWorkers=1 --no-file-parallelism`

Expected: failure on raw method/path and old copy.

- [ ] **Step 3: Implement the presentation boundary and direct copy**

Map timeout, offline, validation, permission and conflict errors before accepting any server string. Use `Acceso seguro`, `Sus datos permanecen en el hospital` and `Disponible en la red del hospital`; remove `Identidad provisional` from login and shell.

- [ ] **Step 4: Run GREEN and commit**

Run the RED command again, then `git commit -m "fix(ux): replace technical operational language"`.

### Task 2: Fast and complete billing catalogue

**Files:**
- Modify: `frontend/src/features/invoices/NewInvoiceView.tsx`
- Modify: `frontend/src/features/invoices/hooks/usePointOfSaleServiceSearch.ts`
- Modify: `frontend/src/features/invoices/components/ServiceSearch.tsx`
- Modify: `backend/app/Http/Controllers/ServiceController.php`
- Modify: `backend/app/Support/ServiceSearch.php`
- Create: `backend/database/migrations/2026_07_22_000001_add_billing_service_search_indexes.php`
- Test: `frontend/src/features/invoices/NewInvoiceView.test.tsx`
- Test: `frontend/src/features/invoices/components/ServiceSearch.test.tsx`
- Test: `backend/tests/Feature/ServiceCatalogTest.php`
- Test: `backend/tests/Feature/Resilience/ServiceSearchPerformanceTest.php`

**Interfaces:**
- Consumes: `apiClient.getServices(ServiceFilters, RequestInit)`.
- Produces: ordered paginated API data with exact, prefix and contains ranking.

- [ ] **Step 1: Write failing frontend tests**

```ts
it('loads billable services without requiring a search term', async () => {
  renderBilling({ services: buildServices(12) });
  expect(await screen.findAllByRole('button', { name: /agregar/i })).toHaveLength(12);
});

it('selecting Todas reloads the unfiltered first page', async () => {
  await user.selectOptions(screen.getByLabelText('Categoría'), 'all');
  expect(apiClient.getServices).toHaveBeenLastCalledWith(expect.objectContaining({ categoryId: undefined, perPage: 24 }), expect.anything());
});
```

- [ ] **Step 2: Run frontend RED**

Run: `npm run test -- NewInvoiceView ServiceSearch --pool=forks --maxWorkers=1 --no-file-parallelism`.

- [ ] **Step 3: Write failing backend ordering and query-count tests**

Seed 10,000 synthetic services, request `search=glucosa`, assert exact result first, 24 bounded rows and no PHP collection ranking path. Record elapsed time against the 500 ms warm budget.

- [ ] **Step 4: Run backend RED**

Run: `docker compose exec -T backend php artisan test --filter='ServiceCatalogTest|ServiceSearchPerformanceTest'`.

- [ ] **Step 5: Implement initial load, debounce/abort and SQL ranking**

Start the page-one search after POS metadata loads even when search is empty. Keep the existing request id and AbortController protections. Replace `fuzzySearch($query->get())` with a SQL `CASE` rank plus paginated query; add composite indexes for billing flags/category/name and code lookup.

- [ ] **Step 6: Run GREEN, migrate and commit**

Run both RED commands, `docker compose exec -T backend php artisan migrate --force`, and commit `perf(billing): accelerate complete service discovery`.

### Task 3: Aligned history and shared table actions

**Files:**
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryTable.tsx`
- Modify: `frontend/src/features/invoices/history/InvoiceHistoryFilters.tsx`
- Modify: `frontend/src/features/invoices/InvoiceHistoryView.tsx`
- Modify: `frontend/src/design-system/patterns/DataTable.tsx`
- Test: `frontend/src/features/invoices/InvoiceHistoryView.test.tsx`
- Test: `frontend/src/features/invoices/history/InvoiceHistoryTable.test.tsx`

**Interfaces:**
- Produces: table toolbar slot containing compact view options and trailing actions.

- [ ] **Step 1: Write failing layout/accessibility tests**

Assert a single toolbar region contains filters and `Configurar columnas`; assert the trigger includes a settings icon and accessible label while visible copy is `Vista`; assert no detached `Columnas` row exists.

- [ ] **Step 2: Run RED**

Run: `npm run test -- InvoiceHistoryView InvoiceHistoryTable --pool=forks --maxWorkers=1 --no-file-parallelism`.

- [ ] **Step 3: Implement compact toolbar and consistent actions**

Move the chooser into the table header action slot, align actions to the trailing edge and preserve mobile cards.

- [ ] **Step 4: Run GREEN and commit**

Commit `refactor(history): align filters columns and row actions`.

### Task 4: One monochrome receipt system

**Files:**
- Create: `frontend/src/features/receipts/receiptViewModel.ts`
- Modify: `frontend/src/features/receipts/ReceiptPreview.tsx`
- Modify: `frontend/src/features/receipts/InstitutionalReceiptPreviewFrame.tsx`
- Modify: `frontend/src/features/receipt-settings/components/ReceiptSettingsPreview.tsx`
- Modify: `frontend/src/printing/styles/receipt-print.css`
- Modify: `backend/app/Actions/InstitutionalReceipts/InstitutionalReceiptHtmlBuilder.php`
- Modify: `backend/resources/views/pdf/institutional-receipts/classic.blade.php`
- Test: `frontend/src/features/receipts/ReceiptPreview.test.tsx`
- Test: `frontend/src/features/receipt-settings/ReceiptSettingsPreview.test.tsx`
- Test: `frontend/src/printing/receipt-print-css.test.ts`
- Test: `backend/tests/Feature/InstitutionalReceiptPdfTest.php`

**Interfaces:**
- Produces: `buildReceiptViewModel(source): ReceiptViewModel` used by sample and issued data.
- Preserves immutable receipt snapshots and fiscal numbering.

- [ ] **Step 1: Write failing convergence tests**

Assert settings and issued receipts render the same ordered landmark names, sample preview says `Ejemplo`, issued preview never shows sample patient data, and print CSS contains no colored receipt bands.

- [ ] **Step 2: Run RED**

Run: `npm run test -- ReceiptPreview ReceiptSettingsPreview receipt-print-css --pool=forks --maxWorkers=1 --no-file-parallelism` and `docker compose exec -T backend php artisan test --filter=InstitutionalReceiptPdfTest`.

- [ ] **Step 3: Implement one view model and monochrome hierarchy**

Normalize institution, receipt, fiscal, patient, items, totals, words, signatures and footer. Make paper profiles spacing adapters. Use black, white and neutral borders in screen, print and PDF.

- [ ] **Step 4: Run GREEN, visually inspect all paper sizes and commit**

Commit `refactor(receipts): unify monochrome institutional documents`.

### Task 5: Simple reports and professional exports

**Files:**
- Modify: `frontend/src/features/reports/ReportsView.tsx`
- Modify: `frontend/src/features/reports/ReportsExecutive.tsx`
- Modify: `frontend/src/features/reports/components/ExecutiveReportFilters.tsx`
- Modify: `frontend/src/features/reports/components/TrendChart.tsx`
- Modify: `backend/app/Actions/Reports/ExecutivePdfExportService.php`
- Modify: `backend/app/Actions/Reports/ExecutiveExcelExportService.php`
- Test: `frontend/src/features/reports/ReportsView.subroutes.test.tsx`
- Test: `frontend/src/features/reports/ReportsExecutive.test.tsx`
- Test: `backend/tests/Feature/Reports/ExecutivePdfExportTest.php`
- Test: `backend/tests/Feature/Reports/ExecutiveExcelExportTest.php`

**Interfaces:**
- Produces: one Apply action and one Export menu with PDF/Excel choices.

- [ ] **Step 1: Write failing screen/export tests**

Assert only `Resumen`, `Caja`, `Auditoría`; one Export menu; monochrome chart palette; PDF headings and Excel sheets use identical totals and Spanish labels.

- [ ] **Step 2: Run RED**

Run focused frontend and backend report tests.

- [ ] **Step 3: Implement simplified flow and export presentation**

Keep data services authoritative; remove decorative alert colors, duplicate export controls and non-actionable copy. Apply restrained typography, totals and tables to generated files.

- [ ] **Step 4: Run GREEN and commit**

Commit `refactor(reports): simplify professional reporting exports`.

### Task 6: Backup and restore reliability

**Files:**
- Modify: `frontend/src/features/backups/BackupsView.tsx`
- Modify: `frontend/src/features/backups/components/BackupStatusBadge.tsx`
- Modify: `backend/app/Actions/Backups/CreateBackupAction.php`
- Modify: `backend/app/Actions/Backups/DatabaseDumpWriter.php`
- Modify: `backend/app/Jobs/RunBackupJob.php`
- Modify: `scripts/restore_hospital_windows.ps1`
- Test: `frontend/src/features/backups/BackupsView.test.tsx`
- Test: `backend/tests/Feature/BackupWorkflowTest.php`
- Test: `scripts/backup_restore_release_contract.test.ps1`

**Interfaces:**
- Produces: human states `En espera`, `Creando`, `Listo`, `No se completó`.
- Produces: disposable restore verifier that never targets the configured production database.

- [ ] **Step 1: Write failing state and integrity tests**

Assert raw queue/storage diagnostics are absent from UI. Assert incomplete artifacts cannot become `success`; encrypted completed artifacts can download, decrypt and restore into a generated disposable database name.

- [ ] **Step 2: Run RED**

Run focused frontend, Laravel and PowerShell tests.

- [ ] **Step 3: Implement state copy, integrity gate and disposable restore**

Write artifacts atomically, verify checksum/encryption metadata before success and keep restore confirmation explicit.

- [ ] **Step 4: Run GREEN and commit**

Commit `fix(backups): certify protected backup recovery`.

### Task 7: Release certification and clean main

**Files:**
- Modify: `frontend/e2e/v1-2-visible-ui-a11y.spec.ts`
- Modify: `frontend/e2e/new-invoice-flow.spec.ts`
- Modify: `frontend/e2e/invoice-history-flow.spec.ts`
- Modify: `frontend/e2e/reports-flow.spec.ts`
- Modify: `frontend/e2e/backups-flow.spec.ts`
- Create: `docs/release/S_HOSPITAL_RELEASE_CERTIFICATION_2026-07-22.md`

- [ ] **Step 1: Add end-to-end acceptance assertions**

Cover all-services initial list, search latency, safe errors, unified receipt, report downloads, backup processing and role-specific language at desktop/mobile/zoom.

- [ ] **Step 2: Run full quality gates**

```powershell
docker compose exec -T backend php artisan migrate:fresh --seed --env=testing
docker compose exec -T backend php artisan test
docker compose exec -T backend vendor/bin/pint --test
docker compose exec -T backend vendor/bin/phpstan analyse
Set-Location frontend
npm run test:segmented
npm run typecheck
npm run lint
npm run check:ui-legacy:final
npm run check:ui-rules
npm run build
npm run test:e2e:mock
```

Expected: zero failures, zero skipped critical tests and zero UI-rule violations.

- [ ] **Step 3: Run release drills**

Run the MariaDB search load profile, encrypted backup/restore into a disposable database, migration rollback/reapply and real-browser screenshots at required sizes.

- [ ] **Step 4: Audit every design acceptance criterion**

Record direct evidence in the certification document. Any missing or indirect evidence remains open work.

- [ ] **Step 5: Commit, push and verify synchronization**

Commit `test(release): certify hospital product convergence`, ensure `git status` is clean, push `main` normally and verify `origin/main...main` is `0 0`.
