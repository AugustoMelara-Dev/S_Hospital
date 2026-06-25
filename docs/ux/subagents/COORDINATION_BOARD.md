# V1.1 Production Polish Coordination Board

Branch base: `codex/v1-1-production-polish`
Base SHA: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Updated: 2026-06-25

## Coordination Rules

- No subagent may touch `main`.
- No subagent may merge old/rescue branches.
- No force push, rebase of remote branches, broad restore/reset, or broad staging.
- No dependency changes without an explicit dependency decision update.
- No backend contract, money calculation, permission, fiscal numbering, receipt snapshot, backup, or restore behavior changes for visual polish.
- Every implementation branch needs focused tests, a handoff note, and a post-commit review before integration.
- Physical production remains not approved until second LAN PC, printer, restore, and LAN load evidence exist.

## Active Orchestrator Branch

| Item | Value |
| --- | --- |
| Branch | `codex/v1-1-production-polish` |
| Worktree | `C:\Projects\S_Hospital-v1-1-polish` |
| Scope | Planning, official research, dependency decision, module audit, small approved P0/P1 fixes, integration readiness |
| Completed commits | `docs(ux): plan v1.1 production polish`; `docs(ux): audit v1.1 module polish gaps`; `fix(fiscal): stop inventing receipt institution lines`; `fix(billing): harden confirmation dialog wrapping`; `fix(receipts): clarify institutional receipt settings`; `fix(reports): improve tab and filter responsiveness`; `fix(reports): align chart accessibility and colors`; `fix(billing): keep mobile cart total visible` |
| Current status | In progress |

## Subagent Matrix

| Subagent | Branch | Worktree | Allowed files | Prohibited files | Dependencies | Status | Commands/evidence | Risks |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A - Design System & UI Foundations | `codex/v1-1-design-system` | `C:\Projects\S_Hospital-v1-1-design-system` | `frontend/src/styles.css`, `frontend/src/components/ui/**`, `frontend/src/components/shared/**`, `frontend/src/lib/utils.ts`, `frontend/src/test/**`, `docs/ux/DESIGN_SYSTEM_V1_1.md` | Feature business logic, backend, migrations, receipts PDF backend, payment/cash calculations | None approved | Planned | Pending | Component API churn could break screens; must keep print/dark mode intact |
| B - Invoice, Payment & Receipt Premium UX | `codex/v1-1-invoice-receipt-premium` | `C:\Projects\S_Hospital-v1-1-invoice-receipt` | `frontend/src/features/invoices/**`, `frontend/src/features/receipts/**`, receipt print CSS, receipt-focused tests, `docs/ux/INVOICE_RECEIPT_PREMIUM_REVIEW.md` | Money math, reducer semantics, idempotency, CAI/series numbering, historical snapshots, permissions | None approved | Partially started by orchestrator on base branch; mobile POS total slice in progress | `npm.cmd run test -- InvoiceConfirmation.test.tsx --run`; `npm.cmd run test -- NewInvoiceViewLayout.test.tsx InvoiceCart.test.tsx --run`; `npm.cmd run typecheck`; `npm.cmd run lint` | Receipt polish can accidentally invent fields or imply physical print approval |
| C - Reports & Analytics Premium | `codex/v1-1-reports-analytics-premium` | `C:\Projects\S_Hospital-v1-1-reports` | `frontend/src/features/reports/**`, dashboard report cards, chart/test files, `docs/ux/REPORTS_ANALYTICS_PREMIUM_REVIEW.md` | Backend report contracts, export calculations, permissions, invented KPIs | None approved | Explorer completed: `019effb2-1ccc-7923-97cf-42bce747de28`; orchestrator tab/filter and chart-token slices in progress | `npm.cmd test -- --run src/features/reports/ReportsView.test.tsx src/features/reports/components/IncomeReportTab.test.tsx src/features/reports/components/CashSessionReportTab.test.tsx`; `npm.cmd run typecheck`; `npm.cmd run lint` | Dense reports may hide data context; chart changes must keep accessibility and dark mode |
| D - Admin, Users, RBAC & Auth UX | `codex/v1-1-admin-auth-polish` | `C:\Projects\S_Hospital-v1-1-admin-auth` | `frontend/src/features/auth/**`, `frontend/src/features/users/**`, access denied UI/tests, `docs/ux/ADMIN_AUTH_UX_REVIEW.md` | Permission semantics, backend policies, role contracts, lockout behavior | None approved | Planned | Pending | Cosmetic changes can accidentally weaken permission clarity |
| E - Operations UX: CashBox, Backups, Catalog, Settings | `codex/v1-1-operations-polish` | `C:\Projects\S_Hospital-v1-1-operations` | `frontend/src/features/cashbox/**`, `frontend/src/features/catalog/**`, `frontend/src/features/backups/**`, `frontend/src/features/settings/**`, `frontend/src/features/receipt-settings/**`, `docs/ux/OPERATIONS_UX_REVIEW.md` | Cash close math/contracts, backup/restore behavior, fiscal numbering semantics, permissions | None approved | Explorer completed: `019effb2-43fc-78e2-9d75-2aac79d11cd4`; orchestrator receipt-settings slice in progress | `npm.cmd run test -- receipt-settings --run`; `npm.cmd run typecheck`; `npm.cmd run lint` | Settings polish can accidentally imply legal data or alter sequence behavior |
| F - Accessibility, Responsive, Performance & QA | `codex/v1-1-a11y-responsive-qa` | `C:\Projects\S_Hospital-v1-1-qa` | Playwright/e2e specs, axe tests, screenshots, `docs/qa/V1_1_POLISH_QA_REPORT.md`, `docs/qa/V1_1_PERFORMANCE_LAN_REVIEW.md` | Production data, backend contracts, business logic | None approved | Partial mocked visual, responsive axe smoke, full frontend unit/component, backend Docker test, and frontend build performance evidence captured by orchestrator | `npx.cmd playwright test e2e/production-readiness.spec.ts` with `E2E_CAPTURE_RC_SCREENSHOTS=1`: 4 passed, 33 screenshots, 0 console issues; `npm.cmd run smoke:buttons`: 7 passed; `npm.cmd run test`: 82 files/487 tests passed; Docker `php artisan test --colors=never`: 49 passed, 668 warnings, 1 skipped; `npm.cmd run build`: passed | Release E2E still needs a reproducible local vendor/PHP path or a Dockerized runner; visual/performance evidence is digital and mocked/local only until real LAN/printer/restore/load validation |

## Integration Order

1. Design system foundations.
2. Operations polish.
3. Admin/auth polish.
4. Invoice/receipt polish.
5. Reports analytics polish.
6. A11y/responsive/QA.
7. Performance/security fixes.

## Current Orchestrator Notes

- The P0 fiscal fallback issue from `MODULE_UX_UI_AUDIT.md` has been fixed on the base polish branch.
- The invoice confirmation long-name wrapping P1 has been fixed on the base polish branch.
- Receipt settings clarity is being addressed on the base polish branch: sensitive correlativo copy, profile selected state, fixed-paper hints, assignment guidance, and preview wording.
- Reports tab/filter/chart polish is being addressed on the base polish branch: labeled report tabs, accent-clean tab labels, wrapping filter controls, tokenized chart colors, and decorative chart SVG hiding where table data already exists.
- POS mobile total visibility is being addressed on the base polish branch with a mobile-only summary/action bar that reuses the existing confirm handler and backend-calculated preview totals.
- Mocked production-readiness screenshots have been extended under `qa/screenshots/v1-1-production-polish/` and summarized in `docs/qa/V1_1_POLISH_QA_REPORT.md`; this is partial digital evidence only.
- `docs/qa/V1_1_PERFORMANCE_LAN_REVIEW.md` records build-size and LAN-risk observations; it does not approve physical LAN operation.
- Responsive button/axe smoke found and the orchestrator fixed a reports chart `aria-hidden` focus issue; `npm.cmd run smoke:buttons` now passes 7/7.
- Full frontend Vitest now passes 82 test files and 487 tests after updating `NewInvoiceView` tests to account for the intentional mobile POS action bar.
- Backend tests pass when Docker mounts the full repo root at `/workspace` with the backend vendor volume; the earlier Compose-only backend mount is insufficient for repo-root guard tests.
- Next safe candidates are deeper receipt/PDF digital proof, successful admin mobile reports evidence, full release gates, and real backend/LAN/printer/restore validation.
- Do not claim V1.1 complete until final report, screenshot evidence, frontend/backend/E2E gates, and unresolved P0/P1 review are done.
