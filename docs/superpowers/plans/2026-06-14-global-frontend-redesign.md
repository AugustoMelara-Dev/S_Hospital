Global Frontend Redesign Implementation Plan
For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

Goal: Redesign every real React screen into one coherent, accessible, institutional hospital cashier interface without changing Laravel contracts, fiscal rules, permissions, receipts, payments, reports, backups, or offline LAN behavior.
Architecture: Keep the current React + TypeScript + Tailwind v4 + Radix foundation and consolidate it into a stricter local design system. Implement in small, commiteable phases: tokens and primitives first, then one functional surface at a time, with visual and automated QA at every phase.
Tech Stack: React 19, TypeScript, Vite, Tailwind CSS v4, Radix UI primitives, lucide-react, TanStack Query, React Hook Form, Zod, Recharts, Playwright, Vitest, vitest-axe, Laravel API, MySQL/MariaDB.
Design Read
Reading this as: regulated hospital cashier/admin product for non-technical LAN users, with a serious institutional operations language, leaning toward a restrained custom Tailwind/Radix design system rather than a marketing-style redesign.
Dial values:
DESIGN_VARIANCE: 4 because this is regulated operational software, not an experimental site.
MOTION_INTENSITY: 2 because speed, clarity, and reduced motion matter more than flourish.
VISUAL_DENSITY: 6 because cashiers and administrators need dense, scannable data without visual clutter.
Current Baseline
Already present and should be reused:
Tailwind v4, Radix UI primitives, lucide-react, clsx, tailwind-merge.
TanStack Query, React Hook Form, Zod, Recharts.
Global UI components in frontend/src/components/ui/.
App shell in frontend/src/layout/.
Canonical navigation in frontend/src/navigation/appNavigation.ts.
Playwright E2E and visual smoke scripts in frontend/e2e/ and qa/visual-smoke/.
Existing screenshots in qa/screenshots/, including modified rc-e2e-2026-06-09-* files.
Do not add @tanstack/react-table or class-variance-authority in this redesign unless a later phase proves a real need. Current primitives can support the redesign.
Screens In Scope
/login
Mandatory password change screen
/dashboard
/billing/new
/cashbox
/catalog
/invoices
/reports
/backups
/settings/fiscal
/admin/users
/help
/about
receipt preview and print surfaces
dialogs, sheets, dropdowns, confirmation modals, loading, empty, error, success, permission-denied and 404 states
desktop, laptop, tablet, mobile, light mode and dark mode
Non-Negotiable Boundaries
Do not change API contracts, Laravel routes, permission names, auth cookies, Sanctum/CSRF behavior, fiscal sequence behavior, money math, invoice creation, payments, reversals, cash close, reports, backups, or audit rules.
Do not recalculate fiscal totals in React as source of truth.
Do not alter receipt print isolation: body[data-printing-receipt="true"] must remain the print gate.
Do not remove receipt formats: half letter, letter, A5, 80mm, 58mm.
Do not overwrite existing tracked screenshot evidence. New evidence must use separate directories.
Do not mix POS/cashbox logic changes with style-only phases.
Subagent Review Result
Decision: APROBADO CON CAMBIOS.
Required changes before coding:
Choose canonical table primitive and document compatibility path.
Address high a11y findings: custom invoice actions menu, modal form errors, password-change errors, warning contrast.
Avoid writing visual evidence into existing qa/screenshots/rc-e2e-2026-06-09-*.
Treat baseline screenshot generation as partially blocked in this environment due EPERM from Playwright/Node when writing PNGs; retry with approved writable destination during execution.
File Map
Core design system:
Modify frontend/src/styles.css: tokens, dark mode, print-safe receipt boundaries, table/utility classes.
Modify frontend/src/components/ui/button.tsx: variants, focus, active states.
Modify frontend/src/components/ui/input.tsx: focus, invalid state support.
Modify frontend/src/components/ui/textarea.tsx: align with input contract.
Modify frontend/src/components/ui/select.tsx: trigger/focus/error consistency.
Modify frontend/src/components/ui/badge.tsx: semantic variants and contrast.
Modify frontend/src/components/ui/alert.tsx: warning contrast, alert semantics.
Modify frontend/src/components/ui/table.tsx: canonical table primitives.
Modify frontend/src/components/ui/data-table.tsx: wrapper around canonical table or compatibility adapter.
Modify frontend/src/components/ui/page-header.tsx: consistent screen headers and action zones.
Modify frontend/src/components/ui/metric-card.tsx: single metric contract.
Modify frontend/src/components/ui/states.tsx: loading, empty, error, permission state copy and visuals.
Create frontend/src/components/ui/form-field.tsx: shared label, hint, error, required marker, ids.
Create frontend/src/components/ui/status-badge.tsx: invoice/cash/payment/backup statuses.
Create frontend/src/components/ui/money-text.tsx: tabular Lempira display.
Create frontend/src/components/ui/action-bar.tsx: page-level action layout.
Layout:
Modify frontend/src/layout/AppShell.tsx.
Modify frontend/src/layout/Sidebar.tsx.
Modify frontend/src/layout/Topbar.tsx.
Modify frontend/src/navigation/appNavigation.ts only if labels/metadata need a visual-state field; do not change paths or permissions.
Screens:
Modify frontend/src/features/auth/LoginView.tsx.
Modify frontend/src/features/auth/PasswordChangeView.tsx.
Modify frontend/src/features/dashboard/DashboardView.tsx.
Modify frontend/src/features/invoices/NewInvoiceView.tsx only for wiring presentation props.
Modify frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx.
Modify frontend/src/features/invoices/components/PatientStep.tsx.
Modify frontend/src/features/invoices/components/ServiceSearch.tsx.
Modify frontend/src/features/invoices/components/InvoiceCart.tsx.
Modify frontend/src/features/invoices/components/InvoiceConfirmation.tsx.
Modify frontend/src/features/invoices/components/PaymentModal.tsx.
Modify frontend/src/features/invoices/components/InvoiceSuccess.tsx.
Modify frontend/src/features/invoices/InvoiceHistoryView.tsx.
Modify frontend/src/features/receipts/ReceiptPreview.tsx.
Modify frontend/src/features/cash/CashBoxView.tsx.
Modify frontend/src/features/cash/components/*.tsx.
Modify frontend/src/features/catalog/CatalogView.tsx.
Modify frontend/src/features/catalog/components/*.tsx.
Modify frontend/src/features/reports/ReportsView.tsx.
Modify frontend/src/features/reports/components/*.tsx.
Modify frontend/src/features/backups/BackupsView.tsx.
Modify frontend/src/features/backups/components/*.tsx.
Modify frontend/src/features/settings/FiscalSettingsView.tsx.
Modify frontend/src/features/settings/components/*.tsx.
Modify frontend/src/features/admin/UsersView.tsx.
Modify frontend/src/features/help/HelpView.tsx.
Modify frontend/src/features/about/AboutView.tsx.
Tests and evidence:
Modify/add focused tests beside changed components.
Use existing frontend/src/**/*.test.*, frontend/e2e/*.spec.ts, qa/visual-smoke/*.mjs.
Update docs/DECISIONS.md after the first design-system phase lands.
Add final QA report under qa/ after implementation, not before.
Phase 0: Baseline Audit And Evidence
Scope:
Preserve current dirty working tree; do not revert user or previous-agent changes.
Generate or collect baseline evidence without overwriting tracked screenshots.
Record UX/a11y issues by screen.
Expected files:
Create qa/GLOBAL_FRONTEND_REDESIGN_AUDIT_2026_06_14.md.
No source code changes.
No migrations.
Steps:

Run git status --short and record dirty files.

Run docker compose up -d.

Run docker compose exec backend php artisan migrate --seed.

Run docker compose ps.

Try mocked capture into a new untracked or temp directory:
cd C:\Projects\S_Hospital\frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
$env:E2E_CAPTURE_SCREENS_DIR='C:\Projects\S_Hospital\qa\screenshots\before-global-redesign-2026-06-14'
npm.cmd run e2e -- rc-screens.spec.ts

If Playwright returns ENOENT, create the directory and retry.

If Playwright returns EPERM, record the blocker and retry in a user-approved writable path. Do not change source code only to work around the capture path.

Run a non-mutating subset of F6 visual smoke if writing is available:
cd C:\Projects\S_Hospital
$env:F6_VISUAL_BASE_URL='http://127.0.0.1:5173'
$env:F6_VISUAL_USER='admin.validacion'
$env:F6_VISUAL_PASSWORD='Password123!'
$env:F6_VISUAL_OUTPUT_PHASE='before-global-redesign-2026-06-14'
$env:F6_VISUAL_FULL='1'
node qa\visual-smoke\f6-operational-polish.mjs
Tests:
docker compose ps
npm.cmd run e2e -- rc-screens.spec.ts if capture permissions allow
Risks:
Current environment may block Playwright/Node screenshot writes with EPERM.
phase-12-visual-smoke.mjs mutates invoices/payments and must not be used without explicit disposable-target approval.
Acceptance criteria:
Baseline audit document exists.
Current screenshot blocker, if any, is documented with exact command/result.
No tracked rc-e2e-2026-06-09-* screenshots are overwritten.
Commit:
docs(frontend): record global redesign baseline audit
Phase 1: Design System Foundation
Scope:
Consolidate tokens and primitives without changing screen logic.
Fix global text encoding/copy issues only where covered by tests or obvious visible text.
Address warning contrast and focus-visible foundations.
Expected files:
frontend/src/styles.css
frontend/src/components/ui/button.tsx
frontend/src/components/ui/input.tsx
frontend/src/components/ui/textarea.tsx
frontend/src/components/ui/select.tsx
frontend/src/components/ui/alert.tsx
frontend/src/components/ui/badge.tsx
frontend/src/components/ui/states.tsx
frontend/src/components/ui/page-header.tsx
frontend/src/components/ui/form-field.tsx
frontend/src/components/ui/status-badge.tsx
frontend/src/components/ui/money-text.tsx
Tests for changed primitives
docs/DECISIONS.md
No migrations.
Implementation rules:
Keep one visual language: institutional off-white/neutral base, restrained teal accent, semantic status tokens.
Avoid app-wide beige dominance if it reduces clinical/operational feel.
Use focus-visible on all interactive primitives.
Replace transition-all with explicit transition properties.
Keep receipt print CSS isolated and avoid app theme bleed into print receipt.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test -- button dialog LoginView
npm.cmd run build
Risks:
Token changes affect all screens and screenshots.
Warning/status color changes can alter visual meaning.
Acceptance criteria:
All UI primitives share tokenized colors, focus states, disabled states and dark-mode behavior.
Warning text reaches WCAG AA contrast for normal text.
rg "transition-all" frontend/src has no hits in modified UI primitives.
No receipt print regression in ReceiptPreview tests.
Commit:
refactor(ui): establish institutional design system tokens
Phase 2: Shell, Navigation, Login, Password Change
Scope:
Redesign app shell, sidebar, topbar, login, password-change and permission/404 states.
Keep route paths and permission checks unchanged.
Add a visible close control to mobile sidebar.
Fix password-change field errors.
Expected files:
frontend/src/layout/AppShell.tsx
frontend/src/layout/Sidebar.tsx
frontend/src/layout/Topbar.tsx
frontend/src/features/auth/LoginView.tsx
frontend/src/features/auth/PasswordChangeView.tsx
frontend/src/components/PermissionGate.tsx
frontend/src/AppRoutes.tsx only for 404/loading copy if needed
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- LoginView PasswordChange AppRoutes appNavigation
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Risks:
Auth screens are covered by a11y tests and can break login smoke.
Sidebar changes can affect permission visibility.
Acceptance criteria:
Login feels like operational access, not a marketing landing page.
Password-change invalid submits expose aria-invalid, aria-describedby, and role="alert" errors.
Mobile sidebar has visible close button and Escape behavior remains.
Sidebar links have visible focus states.
Route labels, paths and permission requirements remain unchanged.
Commit:
refactor(layout): redesign shell and access screens
Phase 3: Canonical Tables, Toolbars, Metrics, Statuses
Scope:
Choose table canonical API.
Unify table header scope, responsive table messaging, empty/loading/error state contracts.
Unify metric cards, status badges and money text.
Do not change data fetching.
Expected files:
frontend/src/components/ui/table.tsx
frontend/src/components/ui/data-table.tsx
frontend/src/components/ui/filter-bar.tsx
frontend/src/components/ui/metric-card.tsx
frontend/src/components/ui/status-badge.tsx
frontend/src/components/ui/money-text.tsx
Consumers in reports/dashboard/backups/cash/catalog/invoices as needed
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- data-table table ReportsView DashboardView CatalogView InvoiceHistoryView CashBoxView
npm.cmd run typecheck
npm.cmd run lint
Risks:
Tables are widespread.
Responsive strategy may change screenshots.
Acceptance criteria:
DataTable and primitive Table share one style and accessibility baseline.
Table headers use scope="col".
Empty/loading/error table states are consistent.
Financial numbers use tabular display through MoneyText or equivalent.
Commit:
refactor(ui): consolidate operational tables and statuses
Phase 4: Dashboard, Help, About
Scope:
Redesign lower-risk informational/admin overview screens.
Consolidate permission-empty states on dashboard.
Keep system health, setup wizard and support diagnostics intact.
Expected files:
frontend/src/features/dashboard/DashboardView.tsx
frontend/src/features/dashboard/CashierList.tsx
frontend/src/features/dashboard/components/SetupWizardDialog.tsx
frontend/src/features/help/HelpView.tsx
frontend/src/features/about/AboutView.tsx
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- DashboardView HelpView AboutView
npm.cmd run typecheck
npm.cmd run lint
Risks:
Setup wizard import progress needs progressbar semantics.
Dashboard differs by role.
Acceptance criteria:
Dashboard presents next operational action clearly per role.
Repeated permission-denied blocks are reduced or visually consolidated.
Setup wizard progress uses role="progressbar" with values and live text.
Help/About remain Spanish institutional and avoid internal technical leakage.
Commit:
refactor(dashboard): clarify operational overview screens
Phase 5: Catalog And Users
Scope:
Redesign catalog and user management screens using shared headers, forms, dialogs, statuses and tables.
Fix user modal field/global errors.
Keep role/permission behavior unchanged.
Expected files:
frontend/src/features/catalog/CatalogView.tsx
frontend/src/features/catalog/components/CategorySheet.tsx
frontend/src/features/catalog/components/ServiceSheet.tsx
frontend/src/features/admin/UsersView.tsx
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- CatalogView ServiceSheet UsersView
npm.cmd run typecheck
npm.cmd run lint
Risks:
Catalog sheets use business fields like special rule, active state and scan codes.
Users screen touches sensitive admin workflows.
Acceptance criteria:
Catalog search/filter/actions are clearer and responsive.
Row action affordances are keyboard accessible.
User dialogs expose inline errors with role="alert", aria-invalid, and descriptions.
No role/permission payload changes.
Commit:
refactor(admin): redesign catalog and user management
Phase 6: POS And Cashbox
Scope:
Redesign /billing/new and /cashbox with strong operational hierarchy.
Keep reducer/API/actions unchanged unless a presentational bug is proven.
Improve service cards, category selection, patient step, cart, payment modal and cash close hierarchy.
Fix category radiogroup keyboard behavior or convert to tabs/listbox pattern.
Expected files:
frontend/src/features/invoices/NewInvoiceView.tsx
frontend/src/features/invoices/components/NewInvoiceViewLayout.tsx
frontend/src/features/invoices/components/PatientStep.tsx
frontend/src/features/invoices/components/ServiceSearch.tsx
frontend/src/features/invoices/components/InvoiceCart.tsx
frontend/src/features/invoices/components/InvoiceConfirmation.tsx
frontend/src/features/invoices/components/PaymentModal.tsx
frontend/src/features/invoices/components/InvoiceSuccess.tsx
frontend/src/features/cash/CashBoxView.tsx
frontend/src/features/cash/components/*.tsx
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- NewInvoiceView InvoiceCart ServiceSearch PaymentModal InvoiceConfirmation InvoiceSuccess CashBoxView SessionSummary
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Backend safety tests:
cd C:\Projects\S_Hospital
docker compose exec backend php artisan test --filter=InvoiceCreationTest --colors=never
docker compose exec backend php artisan test --filter=CashPaymentsReceiptTest --colors=never
Risks:
POS and cashbox are the critical operational path.
Any field renaming can break tests and cashier muscle memory.
Acceptance criteria:
Cashier can understand why emission is disabled before patient/service/cashbox requirements are met.
Primary CTA is clear and stable.
Service cards/tables are scannable.
Cash close emphasizes counted amount, expected amount, difference and required note.
Keyboard flow remains usable.
Commit:
refactor(pos): redesign billing and cashbox workflow
Phase 7: Invoice History, Receipt Preview, Reprint
Scope:
Redesign invoice history, action menus, detail, reprint and receipt preview.
Replace custom actions popover with Radix DropdownMenu or a complete accessible equivalent.
Preserve receipt data and print CSS behavior.
Expected files:
frontend/src/features/invoices/InvoiceHistoryView.tsx
frontend/src/features/receipts/ReceiptPreview.tsx
frontend/src/styles.css only for receipt preview/print updates
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- InvoiceHistoryView ReceiptPreview
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Backend safety tests:
cd C:\Projects\S_Hospital
docker compose exec backend php artisan test --filter=InvoiceHistoryReprintVoidTest --colors=never
docker compose exec backend php artisan test --filter=InvoiceReverseTest --colors=never
Risks:
Reprint and void are audited flows.
Receipt CSS is physically validated later and must not become decorative.
Acceptance criteria:
Action menu supports Enter, Space, Arrow keys, Escape and returns focus to trigger.
Reprint and void confirmations remain explicit.
Receipt preview controls are clear, persistent and accessible.
Receipt print sizes still render without QR/barcode/internal codes.
Commit:
refactor(receipts): redesign history actions and receipt preview
Phase 8: Reports, Backups, Fiscal Settings
Scope:
Redesign dense admin screens while keeping backend-driven totals and exports.
Make backup state executive first, diagnostic second.
Separate fiscal configuration risk groups: institution, sequence, tax, receipt.
Expected files:
frontend/src/features/reports/ReportsView.tsx
frontend/src/features/reports/components/*.tsx
frontend/src/features/backups/BackupsView.tsx
frontend/src/features/backups/components/*.tsx
frontend/src/features/settings/FiscalSettingsView.tsx
frontend/src/features/settings/components/*.tsx
Related tests
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test -- ReportsView IncomeReportTab ServiceSalesTab AuditoriaTab CashSessionReportTab BackupsView FiscalSettingsView
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Backend safety tests:
cd C:\Projects\S_Hospital
docker compose exec backend php artisan test --filter=ReportsTest --colors=never
docker compose exec backend php artisan test --filter=FinancialFactsReportTest --colors=never
docker compose exec backend php artisan test --filter=BackupWorkflowTest --colors=never
Risks:
Report labels communicate financial meaning.
Backup diagnostics are operationally important.
Fiscal settings affect legal/fiscal output.
Acceptance criteria:
Export actions remain visible enough on long report screens.
Reports do not sum frontend data as source of truth.
Backup UI answers: latest status, what to do now, what needs support.
Fiscal form sections communicate risk and prevent accidental edits.
Commit:
refactor(admin): redesign reports backups and fiscal settings
Phase 9: Responsive, Dark Mode, A11y Sweep
Scope:
Cross-screen responsive and dark-mode pass.
Address remaining web-design-guidelines issues.
Add/extend a11y tests for shell and key screens.
Expected files:
frontend/src/**/*.tsx only where specific issues are found
frontend/src/layout/AppShell.a11y.test.tsx
Additional tests beside affected screens
No migrations.
Tests:
cd C:\Projects\S_Hospital\frontend
npm.cmd run test
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
Optional visual smoke if capture destination works:
cd C:\Projects\S_Hospital
$env:F6_VISUAL_BASE_URL='http://127.0.0.1:5173'
$env:F6_VISUAL_USER='admin.validacion'
$env:F6_VISUAL_PASSWORD='Password123!'
$env:F6_VISUAL_OUTPUT_PHASE='after-global-redesign-2026-06-14'
$env:F6_VISUAL_FULL='1'
node qa\visual-smoke\f6-operational-polish.mjs
Risks:
Responsive changes can create hidden overflow.
Dark-mode fixed colors can remain in modules.
Acceptance criteria:
0 visible unlabeled controls in smoke/a11y checks.
0 obvious horizontal overflow on mobile shells.
Warning/destructive/success/info states pass contrast in light and dark mode.
Touch targets are usable on mobile.
Commit:
test(a11y): validate redesigned responsive screens
Phase 10: Final Quality Gate And Report
Scope:
Run full local quality gates.
Capture after evidence where environment permits.
Produce required final report.
Run commit code review orchestrator on diff before final close.
Expected files:
Create qa/GLOBAL_FRONTEND_REDESIGN_FINAL_REPORT_2026_06_14.md.
Update docs/DECISIONS.md with final design-system decision if not already done.
No migrations unless an earlier phase unexpectedly required one; expected none.
Commands:
cd C:\Projects\S_Hospital
docker compose ps
docker compose exec backend php artisan test --colors=never
docker compose exec backend vendor/bin/pint --test
docker compose exec backend vendor/bin/phpstan analyse --memory-limit=1G
docker compose exec frontend npm run typecheck
docker compose exec frontend npm run lint
docker compose exec frontend npm run test
docker compose exec frontend npm run build
E2E:
cd C:\Projects\S_Hospital\frontend
$env:PLAYWRIGHT_EXTERNAL_SERVER='1'
$env:PLAYWRIGHT_BASE_URL='http://127.0.0.1:5173'
npm.cmd run e2e
Risks:
Backend tests can expose unrelated existing failures.
Physical LAN/printer validation cannot be completed in this environment.
Acceptance criteria:
Full gate results recorded.
Any failures are either fixed or explicitly documented with exact command and reason.
Final report includes executive summary, screens redesigned, design system, libraries, components, UX fixes, before/after evidence, commands, tests, files changed and residual risks.
Commit:
docs(frontend): record global redesign qa report
Plan Review Findings
Decision: APROBADO CON CAMBIOS.
Findings:
BLOQUEANTE: Do not implement global changes without approving this plan. Evidence: AGENTS.md requires plan mode and approved review before coding.
ALTA: Current visual evidence scripts can overwrite tracked screenshots. Use isolated output directories.
ALTA: Invoice history custom action menu has accessibility issues. Must be fixed before final a11y approval.
ALTA: User/password forms lack full error announcement semantics. Must be fixed in relevant phases.
ALTA: Warning color contrast is insufficient in light mode. Must be fixed in Phase 1.
MEDIA: Two table APIs create drift. Consolidate in Phase 3.
MEDIA: Fixed semantic colors bypass tokens in several screens. Replace during screen phases.
MEDIA: Mocked screenshots do not prove Laravel/MySQL integration. Use backend tests and real smoke where safe.
BAJA: routes.ts appears legacy compared to appNavigation.ts; avoid depending on it for redesign unless a test proves it is active.
Checklist of entry to implementation:

User approves this plan or chooses a first phase.

Decide execution mode: subagent-driven or inline execution.

Confirm whether current dirty frontend changes are to be continued, reviewed, or separated before Phase 1.

Confirm screenshot output location if Playwright/Node keeps returning EPERM.

Start with Phase 0 or Phase 1 only; do not batch all screens in one commit.
