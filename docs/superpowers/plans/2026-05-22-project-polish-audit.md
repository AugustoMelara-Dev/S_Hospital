# Project Polish Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Identify and close the remaining improvement areas in Sistema de Caja Hospitalaria Offline without breaking offline LAN billing, cashbox, payments, reports, receipts, security, or maintainability.

**Architecture:** The project is already functionally mature: Laravel tests, frontend typecheck/lint/tests/build, Sanctum auth, roles, receipts, reports, backups, and the POS flow exist. This plan avoids a rewrite and instead hardens the last high-leverage seams: money correctness in report/export presentation, frontend bundle boundaries, accessibility/UX verification, SEO/PWA metadata for local LAN discoverability, maintainability documentation, and release proof.

**Tech Stack:** Laravel 12, PHP 8.2, MySQL/MariaDB, React 19, TypeScript, Vite, TanStack Query, Radix UI primitives, Tailwind CSS, Vitest, Playwright.

---

## Current Audit Snapshot

Validation executed on 2026-05-22:

- `backend`: `php artisan test --colors=never` passed, 156 tests and 892 assertions.
- `backend`: `php artisan config:cache` passed.
- `frontend`: `npm.cmd run typecheck` passed.
- `frontend`: `npm.cmd run lint` passed.
- `frontend`: `npm.cmd run test` passed, 5 files and 32 tests.
- `frontend`: `npm.cmd run build` passed.
- `backend`: `composer validate --no-check-publish` could not run because `composer` is not available in PATH in this shell.

Important findings:

- The previous P0 payment-scope issue appears fixed through `App\Support\InvoiceAccess`, `PaymentController`, `RegisterPaymentAction`, and `CashPaymentsReceiptTest`.
- Report/export presentation still casts money to float in `backend/app/Actions/Reports/*ExportService.php`, `IncomeReportService.php`, `OperationsReportService.php`, and `PdfExportService.php`. This is mostly presentation/export code, but it violates the project preference against float money handling.
- Chart tooltip code uses explicit `any` in `frontend/src/features/dashboard/RevenueBarChart.tsx` and `PaymentMethodPieChart.tsx`.
- Production bundle has large chart and app chunks: `charts` around 399.86 kB and `index` around 496.33 kB before gzip. This is acceptable for LAN but worth splitting by routes so cashier-first screens load fast.
- SEO is not classic public web SEO because the product is local/offline, but the app still needs strong metadata, app identity, robots policy, offline-friendly icons/manifest, and health route validation.
- Accessibility has many good labels and Radix primitives, but there is no automated axe-style accessibility gate yet.

## Executive Summary

The project should not be rewritten. The best polish path is a six-phase finishing pass:

1. Money and report/export correctness.
2. Frontend route splitting and type cleanup.
3. Accessibility and UX regression tests.
4. Local SEO/PWA/application metadata.
5. Maintainability and architecture docs.
6. Final release smoke evidence.

Each phase is small, testable, and committable. No new risky feature is enabled globally. Any new gate starts as CI/local tooling and does not affect runtime billing.

## Implementation Progress

- Phase 1 completed on 2026-05-22 with commit `42ebaa1`: report money arithmetic is isolated in cent-based helpers and protected by `ReportMoneyArchitectureTest`.
- Phase 2 completed on 2026-05-22: dashboard is split into a lazy route chunk, chart tooltip formatters no longer use explicit `any`, and frontend test/typecheck/lint/build gates pass.
- Phase 3 completed on 2026-05-22: Playwright accessibility/UX smoke covers POS keyboard flow, cash close focus/cancel safety and responsive operational navigation without adding dependencies.
- Phase 4 completed on 2026-05-22: local app metadata, private robots policy, manifest and SVG icons are served from the offline build.
- Phase 5 completed on 2026-05-22: current backend/frontend architecture and release gates are documented.
- Phase 6 completed on 2026-05-22: full automated gates and local `/up`, `/login`, `/verify-email` smoke passed, with residual physical risks documented.

## Explicit Assumptions

- Production remains offline LAN with one server PC and browser clients.
- Backend remains the source of truth for money, invoice status, fiscal numbers, payments, cash sessions, voids, reports, and receipts.
- No Supabase cloud, Firebase, SaaS-only dependency, or internet runtime dependency will be introduced.
- Patient scope remains name-only billing, not clinical records.
- SEO means browser/app metadata for the LAN-hosted product, not public search ranking.
- Any new package must be installable during development/build and must not be consumed from CDN at runtime.

## Blocking Questions

No question blocks planning. Before implementing Phase 3, decide whether adding `axe-core`/`@axe-core/playwright` is acceptable as a dev dependency. Safe default if not approved: implement accessibility checks with Testing Library and Playwright role/keyboard assertions only.

## Proposed Architecture

Backend polish:

- Keep report calculations in Actions/Services.
- Add a small report money formatter/helper where exports need numeric spreadsheet cells and string display values.
- Avoid floats for authoritative totals. If a library requires numeric spreadsheet cells, isolate the conversion and keep API/report payloads decimal-string based.

Frontend polish:

- Preserve current component library and feature folder structure.
- Use React Router lazy route modules for heavy screens, especially dashboard/reports/charts.
- Keep cashier/POS route eagerly reliable or in a small chunk.
- Add accessibility smoke tests around keyboard navigation, labels, dialogs, and receipt printing.

Docs/QA polish:

- Store final evidence under `qa/` and architectural decisions in `docs/DECISIONS.md`.
- Keep release instructions honest: what passed locally, what requires physical printer/LAN validation, and what cannot be automated.

## Data Model And Migrations

No schema migrations are expected.

If Phase 4 adds PWA metadata, expected files are frontend/public assets or Vite-served static files only. If backend serves built frontend assets, update backend SPA asset handling only if necessary.

## Modules And Phases

### Phase 1: Report Money Correctness

**Scope**

- Remove direct `(float)` arithmetic from report services where values represent money.
- Keep API money values as decimal strings.
- Isolate spreadsheet/PDF display conversion in one helper with tests.

**Files**

- Modify: `backend/app/Actions/Reports/IncomeReportService.php`
- Modify: `backend/app/Actions/Reports/OperationsReportService.php`
- Modify: `backend/app/Actions/Reports/ExcelReportService.php`
- Modify: `backend/app/Actions/Reports/InstitutionalExcelExportService.php`
- Modify: `backend/app/Actions/Reports/PdfExportService.php`
- Modify or create: `backend/app/Actions/Reports/Concerns/FormatsReportMoney.php`
- Test: `backend/tests/Feature/ReportsTest.php`

**Steps**

- [ ] Add failing coverage in `ReportsTest` for fractional category allocation and exported totals using values such as `0.10`, `0.20`, and `0.30`.
- [ ] Run `php artisan test --colors=never --filter=ReportsTest`; expected result before fix: a failure or a documented assertion that exposes float formatting risk.
- [ ] Update `FormatsReportMoney` with cent-based helpers: `decimalToCents(string $value): int`, `centsToDecimal(int $cents): string`, and `formatLempiras(string $value): string`.
- [ ] Replace report allocation arithmetic with cent-based math.
- [ ] For spreadsheet numeric cells, use a single helper such as `decimalForSpreadsheet(string $value): float` and document that it is display-only, not domain calculation.
- [ ] Run `php artisan test --colors=never --filter=ReportsTest`; expected result: pass.
- [ ] Run full backend test suite.
- [ ] Commit: `fix(reports): isolate money formatting for exports`.

**Risks**

- Spreadsheet libraries prefer numeric floats for currency cells. Mitigation: isolate conversion at the export boundary and leave report APIs as decimal strings.

**Acceptance Criteria**

- No float arithmetic remains in report services for authoritative totals.
- Report tests cover cents-sensitive cases.
- Exports still open with numeric currency cells where currently expected.

### Phase 2: Frontend Bundle And Type Cleanup

**Scope**

- Split heavy dashboard/chart route.
- Remove explicit `any` in chart tooltip formatters.
- Keep POS route fast and stable.

**Files**

- Modify: `frontend/src/AppRoutes.tsx`
- Modify: `frontend/src/features/dashboard/RevenueBarChart.tsx`
- Modify: `frontend/src/features/dashboard/PaymentMethodPieChart.tsx`
- Test: `frontend/src/App.test.tsx`
- Test: `frontend/src/features/reports/ReportsView.test.tsx`

**Steps**

- [x] Add or adjust route coverage proving active modules render without mounting unrelated views.
- [x] Replace chart formatter `any` with Recharts-compatible value/name types, for example `type ChartTooltipValue = string | number | Array<string | number>`.
- [x] Convert the dashboard feature route import to `React.lazy` in `AppRoutes.tsx`.
- [x] Wrap routes with the existing loading state and preserve permission gates.
- [x] Run `npm.cmd run typecheck`; expected result: pass.
- [x] Run `npm.cmd run lint`; expected result: pass.
- [x] Run `npm.cmd run test`; expected result: pass.
- [x] Run `npm.cmd run build`; expected result: pass and chunks still build without route regressions.
- [ ] Commit: `perf(frontend): split heavy operational routes`.

**Risks**

- Lazy loading can hide permission errors or fallback loops. Mitigation: route tests must cover permission-denied and successful paths.

**Acceptance Criteria**

- POS remains reachable without dashboard route code in its initial route.
- No explicit `any` remains in the dashboard chart tooltip formatters.
- Build output shows route or chart chunks separated cleanly.

### Phase 3: Accessibility And UX Regression Gate

**Scope**

- Add automated accessibility checks for critical local workflows.
- Confirm keyboard navigation for POS, dialogs, cash close, and receipt width selection.
- Ensure text and controls do not overlap on representative desktop/tablet/mobile viewports.

**Files**

- Modify: `frontend/e2e/production-readiness.spec.ts`
- Possibly modify: `frontend/playwright.config.ts`
- Possibly create: `qa/ACCESSIBILITY_UX_AUDIT.md`
- Modify only if tests expose defects: affected `frontend/src/features/**` components.

**Steps**

- [x] Decide dev dependency strategy: use existing Playwright role, label, keyboard, focus-trap, and viewport assertions without adding axe.
- [x] Add Playwright checks for `/billing/new`: patient input label, service search label, keyboard add flow, confirm dialog focus, payment modal focus, and receipt width selector.
- [x] Add Playwright checks for `/cashbox`: open session form, close session dialog, required note on difference, and cancel safety.
- [x] Add viewport checks for 390x844, 768x1024, and 1280x800.
- [x] Run `npm.cmd run e2e` or the scoped production readiness command used by the repo.
- [x] Document results in `qa/ACCESSIBILITY_UX_AUDIT.md`.
- [ ] Commit: `test(ux): add accessibility regression smoke`.

**Risks**

- E2E may be slower or flaky. Mitigation: keep tests deterministic with existing mocks and reserve real API smoke for Phase 6.

**Acceptance Criteria**

- Critical flows are keyboard-operable.
- Dialogs have accessible names and focus returns after close.
- No known visual overlap on target viewports.

### Phase 4: Local SEO, App Identity, And Offline Metadata

**Scope**

- Improve app metadata for the LAN product: title, description, theme color, icons, manifest, robots policy, and structured app identity where appropriate.
- Do not imply public indexing or internet dependency.

**Files**

- Modify: `frontend/index.html`
- Possibly create: `frontend/public/manifest.webmanifest`
- Possibly create: `frontend/public/icons/*`
- Modify if serving static assets through Laravel: `backend/routes/web.php`
- Test: `backend/tests/Feature/ProductionSpaRouteTest.php`
- Test: `frontend/src/App.test.tsx` if metadata is asserted there.

**Steps**

- [x] Add test coverage for SPA metadata served in production build route if backend currently validates built assets.
- [x] Add `meta description`, `theme-color`, app name, viewport, manifest link, and local-friendly robots policy.
- [x] Ensure `backend/public/robots.txt` and frontend metadata do not conflict.
- [x] Add app icons only as local static assets, no remote CDN.
- [x] Run `npm.cmd run build`.
- [x] Run `php artisan test --colors=never --filter=ProductionSpaRouteTest`.
- [ ] Commit: `feat(app): add offline lan app metadata`.

**Risks**

- Public SEO patterns may be misleading for a LAN app. Mitigation: use metadata for browser identity and installability, not public discoverability.

**Acceptance Criteria**

- Browser tab, saved shortcut, and install metadata identify the hospital billing system clearly.
- No runtime network request is required for metadata/icons.
- Robots policy remains appropriate for local/private software.

### Phase 5: Maintainability And Architecture Documentation

**Scope**

- Document current architecture, module boundaries, and quality gates.
- Capture decisions made during polish.
- Update release checklist with accurate commands and environment caveats.

**Files**

- Modify: `docs/DECISIONS.md`
- Possibly create: `docs/ARCHITECTURE_CURRENT.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `docs/API_CONTRACTS.md` only if implementation changed contracts.

**Steps**

- [x] Document backend boundaries: controllers, Form Requests, Actions, report services, support helpers.
- [x] Document frontend boundaries: routes, layout, feature modules, UI primitives, query hooks, schemas.
- [x] Document money handling policy after Phase 1.
- [x] Document route-splitting policy after Phase 2.
- [x] Update release checklist with exact commands that passed locally and note composer PATH caveat if still unresolved.
- [ ] Commit: `docs(architecture): document current module boundaries`.

**Risks**

- Docs can drift. Mitigation: tie docs to implemented files and commands, not aspirational architecture.

**Acceptance Criteria**

- A new contributor can locate billing, payment, cash, report, receipt, backup, and UI architecture in under five minutes.
- Release checklist distinguishes automated gates from physical LAN/printer validation.

### Phase 6: Final Release Smoke And Evidence

**Scope**

- Run final local quality gates.
- Run real smoke if services are available.
- Record what passed and what remains physical/manual.

**Files**

- Modify or create: `qa/PROJECT_POLISH_FINAL_REPORT.md`
- Modify: `qa/RELEASE_READINESS.md` if present and still current.
- No runtime source changes expected unless tests reveal defects.

**Steps**

- [x] Run `php artisan test --colors=never`.
- [x] Run `php artisan config:cache`.
- [x] Run `npm.cmd run typecheck`.
- [x] Run `npm.cmd run lint`.
- [x] Run `npm.cmd run test`.
- [x] Run `npm.cmd run build`.
- [x] Run `npm.cmd run e2e` if Playwright browsers and app mocks are available.
- [x] If local app is running, validate `/up`, `/login`, and `/verify-email`; otherwise record as not executed with reason.
- [x] Write `qa/PROJECT_POLISH_FINAL_REPORT.md` with commands, dates, outcomes, and residual risks.
- [x] Execute commit-review prompt `prompts/03_COMMIT_CODE_REVIEW_ORCHESTRATOR.md` against the diff.
- [x] Correct critical/high findings.
- [ ] Commit: `test(release): record project polish evidence`.

**Risks**

- Real smoke may require Docker/app services not currently running. Mitigation: do not fake evidence; record blocked external prerequisites honestly.

**Acceptance Criteria**

- All available automated gates pass.
- Release evidence is explicit and reproducible.
- No critical/high review findings remain.

## TDD And Test Plan By Phase

- Phase 1: backend Feature tests around report/export money edge cases.
- Phase 2: frontend route/type tests plus build output check.
- Phase 3: Playwright workflow accessibility checks and optional axe scan.
- Phase 4: metadata route/build tests.
- Phase 5: docs review only; no runtime tests unless contracts change.
- Phase 6: full quality gate and commit-review orchestration.

## Commit Plan

1. `fix(reports): isolate money formatting for exports`
2. `perf(frontend): split heavy operational routes`
3. `test(ux): add accessibility regression smoke`
4. `feat(app): add offline lan app metadata`
5. `docs(architecture): document current module boundaries`
6. `test(release): record project polish evidence`

## Technical Risks And Mitigations

- **Money correctness:** avoid report arithmetic in floats; isolate display-only conversion.
- **Lazy route regressions:** cover routes with tests and keep POS path simple.
- **E2E flakiness:** keep accessibility smoke deterministic and scoped.
- **Dependency creep:** add no runtime dependency unless it solves a clear problem; dev-only accessibility dependency requires approval.
- **Offline runtime:** no CDN, no SaaS, no remote fonts, no external metadata.
- **False release confidence:** separate automated gates from physical printer/LAN validation.

## Verification Commands

Backend:

```powershell
cd C:\Projects\S_Hospital\backend
php artisan test --colors=never
php artisan config:cache
```

Frontend:

```powershell
cd C:\Projects\S_Hospital\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run build
npm.cmd run e2e
```

Optional when Composer is available:

```powershell
cd C:\Projects\S_Hospital\backend
composer validate --no-check-publish
```

Smoke deploy/local:

```powershell
Invoke-WebRequest http://localhost/up
Invoke-WebRequest http://localhost/login
Invoke-WebRequest http://localhost/verify-email
```

## Plan Review Orchestrator Result

**Decision:** APROBADO CON CAMBIOS.

| Subagent | Severity | Finding | Evidence | Required Change |
| --- | --- | --- | --- | --- |
| Architecture and maintainability | MEDIA | Avoid rewrite; project already has mature module boundaries. | Existing `backend/app/Actions`, `frontend/src/features`, UI primitives. | Keep phases incremental and document current architecture. |
| Database and transactions | BAJA | No migration needed; money presentation still uses floats in report/export code. | `rg "(float)" backend/app/Actions/Reports`. | Phase 1 must isolate money conversion and add tests. |
| Security and privacy | BAJA | Previous payment-scope P0 appears resolved. | `InvoiceAccess`, payment tests. | Do not weaken access checks while refactoring reports/routes. |
| UI/UX cashier workflow | MEDIA | UX looks covered by components, but needs regression evidence. | Existing POS/cash components and tests. | Phase 3 must add keyboard/viewport checks. |
| Performance and local scalability | MEDIA | Large chart/app chunks can slow first cashier load on weaker LAN PCs. | Vite build output: chart and index chunks. | Phase 2 route splitting. |
| Offline LAN and backups | BAJA | Runtime stays local; metadata must not introduce remote requests. | Existing offline docs and backup tests. | Phase 4 must use local static assets only. |
| Tests and QA | MEDIA | Automated gates pass, but composer validate unavailable and accessibility gate absent. | Command results from 2026-05-22. | Phase 3 and Phase 6 evidence. |
| Hospital billing domain | BAJA | Core domain tests pass, including erythropoietin, cash, receipts, voids. | 156 backend tests passed. | Do not expand into clinical records or inventory. |

**Changes required before coding:** get explicit approval to execute this plan phase-by-phase. If Phase 3 needs a new dev dependency for axe, ask before installing it.

## Implementation Entry Checklist

- [ ] User approves this plan or requests edits.
- [ ] Work remains on branch `codex/project-polish-audit-plan`.
- [ ] Implement one phase at a time.
- [ ] Run phase-specific gates before each commit.
- [ ] Run commit review prompt after each commit diff.
- [ ] Document decisions in `docs/DECISIONS.md`.
