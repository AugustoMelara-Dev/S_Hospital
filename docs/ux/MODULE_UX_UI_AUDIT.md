# V1.1 Module UX/UI Audit

Branch: `codex/v1-1-production-polish`
Base: `2e1949e6e1cccbccf8ae5c94a9472739fd0d14ac`
Worktree: `C:\Projects\S_Hospital-v1-1-polish`
Date: 2026-06-25

## Scope

This audit reviews the active React screens, shared UI primitives, print surfaces, dark mode, empty/error/loading states, and cashier-critical flows before the V1.1 production polish implementation. It does not approve physical go-live. Physical evidence still requires a second LAN client, installed printer, restore drill, and LAN load validation.

Sources inspected:

- `frontend/src/App.tsx`
- `frontend/src/AppRoutes.tsx`
- `frontend/src/styles.css`
- `frontend/src/navigation/appNavigation.ts`
- `frontend/src/layout/AppShell.tsx`
- `frontend/src/layout/Topbar.tsx`
- `frontend/src/layout/components/MobileNavigation.tsx`
- `frontend/src/components/PermissionGate.tsx`
- `frontend/src/components/AppErrorBoundary.tsx`
- `frontend/src/components/ui/*`
- `frontend/src/features/auth/*`
- `frontend/src/features/dashboard/DashboardView.tsx`
- `frontend/src/features/invoices/*`
- `frontend/src/features/cashbox/CashBoxView.tsx`
- `frontend/src/features/catalog/CatalogView.tsx`
- `frontend/src/features/reports/ReportsView.tsx`
- `frontend/src/features/backups/BackupsView.tsx`
- `frontend/src/features/settings/FiscalSettingsView.tsx`
- `frontend/src/features/receipt-settings/*`
- `frontend/src/features/users/UsersView.tsx`
- `frontend/src/features/help/HelpView.tsx`
- `frontend/src/features/support/SupportCenterView.tsx`
- `frontend/src/features/about/AboutView.tsx`
- institutional receipt and legacy receipt preview docs/tests already present in the repo.

## Priority Scale

- P0: Must fix before claiming V1.1 production polish. Legal, money, irreversible action, or receipt trust risk.
- P1: Should fix in the V1.1 polish branch. Major cashier/admin usability, responsive, accessibility, or clarity issue.
- P2: Polish if time allows, or include in a follow-up phase with low risk.
- OK: No blocking UX issue found during static audit.

## Executive Findings

| Priority | Area | Finding | Recommended phase |
| --- | --- | --- | --- |
| P0 | Fiscal settings | The fiscal settings form has fallback text for government/secretariat/location when API values are missing. V1.1 instructions explicitly prohibit invented legal/government text. | Phase 7, receipt/invoice trust |
| P0 | Verification | Current audit is static. No screenshot, Playwright, printer, second LAN client, restore, or load proof exists for V1.1 yet. | Phases 14-16, QA and evidence |
| P1 | New invoice mobile | POS flow is strong, but mobile total/cart visibility may require scrolling after service search. Cashiers need total and action status visible during high-volume work. | Phase 8, POS polish |
| P1 | Invoice confirmation | Long service or patient names can stress dialog row layout. Need `min-w-0`, wrapping, and mobile screenshot proof. | Phase 7 or 8 |
| P1 | Reports | Reports contain many tabs, metrics, exports, and dense grids. The shared `TabsList` helps, but this screen still needs responsive screenshot proof and stronger grouping. | Phase 6, reports polish |
| P1 | Receipt settings | Receipt series/current-number editing is sensitive and assignment by raw user/cash-session IDs is operationally technical. Needs clearer warnings/selectors. | Phase 7 |
| P1 | Backups/support admin | Backup and diagnostic screens are comprehensive but dense; technical labels should stay behind advanced/admin affordances. | Phase 11 or 12 |
| P1 | Spanish copy fidelity | Several visible strings lack accents or show encoding-sensitive text in terminal output. Verify browser rendering and normalize visible copy during polish. | Cross-phase |
| P2 | Palette | Current teal/slate institutional palette is sober and appropriate, but charts/status states should avoid becoming visually one-note. | Phase 5 |

## Module Audit

| Module | Current state | UX/UI issues | A11y/responsive/perf notes | Risk | Recommendation | Priority | Owner track |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Login (`/login`) | Polished split/card login with logo, status alert, lockout countdown, password visibility, and safe error text. | Error variant is derived from `status.includes('inv')`, which is brittle for Spanish text. Some visible copy should be verified for accents in browser. | Good focusable controls and loading states. Needs mobile screenshot proof. | Misclassified toast/alert could reduce clarity during login failures. | Use explicit status variant state instead of string matching. Verify 320px, tablet, and desktop login screenshots. | P2 | Auth UX |
| Password change | Strong RHF/Zod policy, visible requirements, disabled states, and confirmation. | Some copy is ASCII-only where user-facing Spanish could be polished. | Good validation and focusable form. | Low; mainly presentation. | Normalize visible Spanish copy while preserving source encoding. | P2 | Auth UX |
| Dashboard (`/dashboard`) | Managerial dashboard has setup status, KPIs, payment mix, top services, revenue, cashiers, and next actions. | Cashier-only dashboard may feel sparse depending on permissions/data. Chart cards need no-data and low-data screenshots. | Query-gated by permission; needs dark mode and mobile proof. | Operators may not know what to do if their dashboard has minimal permissions. | Add role-sensitive next-action emphasis and stronger empty states if screenshots confirm gaps. | P1 | Reports/dashboard |
| New invoice (`/billing/new`) | Mature POS workflow: patient first, service search, cart, scanner, cash-session guard, backend source of truth, payment modal, receipt flow. | On mobile, cart/totals may sit below search results and categories; total/action status may not remain visible enough for high-volume cashier use. | Many refs prevent double-submit; dirty guard exists. Needs keyboard-only pass and 320px screenshots. | Cashier can lose context or issue slower on crowded mobile/low-width terminals. | Make mobile totals/action bar persistent or easier to reach; prove no overlap with keyboard, dialogs, and empty states. | P1 | POS |
| Service search | Intent-first search, scanner, category/area filters, limited result count, skeletons, empty states, erythropoietin note. | Category/area controls may consume vertical space on small screens before results. Some labels such as `Area` need accent polish if rendered that way. | Radiogroup/button model is generally good. Needs keyboard arrow/tab proof. | Slower service selection on small screens. | Compress filters on mobile, preserve keyboard path, and validate scanner field focus. | P1 | POS |
| Invoice cart | Sticky desktop cart and item controls support high-volume review. | Mobile position may not keep total in view. Long service names and modifiers need overflow proof. | Existing tests cover pieces; still needs visual proof. | Money/action context can be missed. | Add mobile total summary bar or improve layout after screenshot findings. | P1 | POS |
| Invoice confirmation dialog | Focuses confirm button, presents patient/items/totals, warns backend price is source of truth. | Long service/patient names may overflow or misalign against amounts because row content is mostly flex without robust `min-w-0` wrapping. | Dialog is accessible via shared primitive. Needs small viewport proof. | Final confirmation may be hard to review for long catalog names. | Harden wrapping and amount alignment; add test for long service names. | P1 | POS/receipts |
| Payment modal | Strong payment UX: auto-focus, cash change, non-cash cap, partial payment alerts, disabled submit, preview toggle, cancel warning. | Primary CTA text can become long on narrow screens. Payment preview needs screenshots for all payment methods. | Good disabled states and role messages. Needs keyboard-only and screen reader label pass. | Low-to-medium; payment is critical so proof matters. | Ensure CTA wraps professionally or uses shorter mobile labels; add screenshot cases. | P1 | POS/payments |
| Invoice success | Provides post-payment status and receipt path. | Needs proof that print/reprint choices remain clear after PDF opens or browser popup is blocked. | Browser PDF opening cannot prove physical print. | Operator may think payment was reversed if print fails. | Keep explicit "payment recorded" language and add popup-blocked fallback if absent. | P1 | Receipts |
| Cashbox (`/cashbox`) | Strong operational model: current session, open/close flow, expected cash, movements, pending balance guard, polling. | Dense close-session panels can be hard on small screens; difference/counted cash hierarchy needs screenshot review. | Uses query polling and in-flight refs. Need keyboard proof for closing dialog. | Cash close mistakes are money-critical. | Prioritize the close-session dialog and summary cards in visual QA; improve mobile grouping if needed. | P1 | Cashbox |
| Catalog (`/catalog`) | Server pagination/filtering, manage gates, scanner support, service/category/admin flows. | Uses manual state/API style more than TanStack Query; not a visual blocker but inconsistent. Tables/actions may compress on mobile. | Need no-data, loading, edit-sheet, and long service name screenshots. | Catalog mistakes affect future invoices. | Keep scope to visual polish first; add mobile table/action verification. | P1 | Catalog |
| Invoice history (`/invoices`) | Good filters, paginated table, receipt/reprint/anular/reversar actions, audit reasons, institutional PDF preference, legacy fallback. | Action cluster can grow large per row; table is min-width 920 and scrollable, but mobile action discovery may be heavy. Reprint modal copy has long text. | Shared table region is keyboard focusable. Needs mobile horizontal scroll proof. | Operators may miss action buttons or scroll context. | Consider row action menu on small screens only, or clearer grouped actions. Validate receipt/reprint with long invoice numbers. | P1 | History/receipts |
| Reports (`/reports`) | Feature-rich reporting suite with executive filters, tabs, exports, daily/monthly/range/cash/payment/service/cashier/audit views. | Very dense surface. Many tabs and export actions need stronger visual grouping and mobile proof. Some raw buttons/classes diverge from UI primitives. | Recharts use should be checked for stable containers, legends/labels, no blank charts, and table fallback where needed. | High cognitive load for admin; export mistakes can cause wrong operational decisions. | Polish in a dedicated reports phase; keep charts with accessible labels and fallback summaries. | P1 | Reports |
| Backups (`/backups`) | Comprehensive operational backup center: status, create/download, preflight, proofs, filters, table, admin details. | Dense advanced data can overwhelm. Some terms such as worker/SHA256 should stay behind admin/advanced context. | Needs disabled/loading proof for create/download and confirm dialogs. | Backup operations are critical and can be misunderstood. | Split operator summary from admin diagnostics visually; keep destructive/restore language guarded. | P1 | Ops/admin |
| Fiscal settings (`/settings/fiscal`) | Organized tabs for hospital, sequence, branding, preview, and confirmation around sequence save. | P0: default/fallback values include government/secretariat/location text when data may be absent. This can create invented institutional/legal copy. | Form structure is solid; sensitive fields need stronger pending/blank state. | Legal/institutional trust risk. | Remove invented fallbacks. Empty config should show blank or "Configuracion pendiente" without saving invented values. Add tests. | P0 | Receipts/fiscal |
| Institutional receipt settings (`/settings/institutional-receipts`) | Strong dedicated receipt configuration with institution, series, paper/copies, profile assignment, preview, tests. | Current-number editing is sensitive; profile assignment by raw numeric IDs is hard for admins. Some labels need accent polish. | Tabs are scrollable via shared TabsList. Needs print preview dark/light proof. | Incorrect sequence/profile can affect receipts. | Add warnings/confirmation around numbering, use clearer selectors/labels for assignments, preserve audit trail. | P1 | Receipts/fiscal |
| Institutional PDF receipt | Backend/PDF path is treated as primary for paid invoices. The flow avoids QR/barcode/internal codes per product rules. | Needs browser PDF screenshot plus physical printer proof in later validation. Fiscal text must come only from saved config. | Print/PDF cannot be fully validated by unit tests. | Receipt trust is core product value. | Add evidence checklist for letter, half-letter, and A5; verify no QR/barcode/internal codes and no invented CAI/government text. | P0 | Receipts |
| Legacy `ReceiptPreview` | Secondary compatibility for invoices without institutional PDF; supports sizes including 80mm/58mm and print audit. | Displays pending CAI/range placeholders; acceptable only as legacy fallback. Must not be confused with main receipt. | Print CSS exists; browser print result still needs proof. | Users may use fallback as official if labels are unclear. | Keep "fallback legacy" language visible in dialogs; prefer institutional PDF path. | P1 | Receipts |
| Users/admin (`/admin/users`) | Rich user/role/password/admin flow with protected roles, permission catalog, activation, and reset controls. | Permission editor may expose raw permission names; action-heavy tables need mobile proof. | Critical dialogs need keyboard/focus validation. | Admin can misassign access if permissions are too raw. | Add grouped permission explanations and responsive action handling if screenshots show compression. | P1 | Admin/RBAC |
| Help (`/help`) | Very complete operational manual with role guides, incidents, shortcuts, delicate actions, support evidence. | Large card grid can be lengthy; some visible copy/accent fidelity should be verified. | Good support evidence copy avoids secrets. Needs search/anchor consideration later. | Operators may need faster access during incidents. | Add top-level quick links or collapse sections only if screenshots/user flow show overload. | P2 | Support/docs |
| Support (`/support`) | Focused continuity view with status summary, role checklist, support playbooks. | Copy should normalize accents. Advanced status should stay role-gated. | Good error fallback and safe messages. | Low if role gating holds. | Verify loading/error state screenshots and safe-message redaction. | P2 | Ops/support |
| About (`/about`) | Operational overview with local status, backups count, diagnostics for admins, support info. | Diagnostic cards expose operational details; keep admin-only. Copy/accent fidelity needs browser proof. | Uses status badges and responsive grids. | Low-to-medium; useful for support but can become noisy. | Keep compact; add clearer "diagnostico administrativo" separation if visual proof shows clutter. | P2 | Ops/support |
| 404 | Uses shared `EmptyState` route fallback. | Needs a clear return action to dashboard/help if not already in fallback. | Shared state accessible. | Low. | Add screenshot; improve action if page feels like a dead end. | P2 | Navigation |
| Access denied | `PermissionGate` has helpful Spanish message and help link. | Uses plain anchor `href="/help"` inside button; acceptable but may full-reload depending router behavior. | Screen is readable and actionable. | Low. | Consider `Link` to preserve SPA behavior; screenshot role-denied case. | P2 | Navigation/RBAC |
| Global loading | Shared `LoadingState` with aria status/busy and skeletons. | Card-based skeleton is generic; some modules may need domain-specific loading rows. | Good baseline. | Low. | Use table-specific skeletons for dense admin tables where needed. | P2 | Design system |
| Global error | Error boundary stores safe issue and provides reload/help. `ErrorState` covers module fetch failures. | User copy says technical detail was stored; verify it never shows secrets. | Good `role=alert` and recovery actions. | Medium if sanitization fails, otherwise low. | Add/redrive tests for safe client issue summaries and screenshot error boundary. | P1 | Support/security |
| Mobile navigation | Radix Dialog drawer with overlay, focus return, sr-only title/description, close button, sidebar content. | Width and close affordance look reasonable; needs screenshot and keyboard trap proof. | Good use of Dialog. | Low. | Verify at 320px, 390px, tablet; check active route and cash session badge. | P1 | Navigation |
| Dark mode | CSS has light/dark token sets and system-wide variables. | Need contrast pass for warning, destructive, chart colors, sidebar, receipt preview, and badges. | Reduced-motion exists. | Medium because hospital terminals may use dim screens. | Run axe/contrast checks and screenshot each priority flow in dark mode. | P1 | Design system/a11y |
| Print and paged media | `styles.css` includes receipt print classes, page sizes, `@page`, `break-inside`, and print-specific visibility. | Physical output is not validated. Need no-overlap proof for institutional PDF and fallback sizes. | Browser print/PDF differs from physical printers. | High for receipt trust. | Validate letter, half-letter, A5 digital PDF; later validate actual printer and 80mm/58mm fallback. | P0 | Receipts/QA |

## Cross-Cutting Design System Notes

- The app already has useful shared primitives: `Button`, `Card`, `Table`, `Tabs`, `EmptyState`, `ErrorState`, `LoadingState`, `StatusBadge`, dialogs, and filter/date controls.
- `Table` correctly wraps tables in a focusable region with an accessible label. Dense tables should keep explicit `min-w-*` values and container labels.
- `TabsList` already supports horizontal overflow, reducing risk in report/settings tabs. Individual tabs still need screenshot proof because content can remain dense.
- Existing `styles.css` is more mature than a blank redesign: Tailwind theme variables, dark mode, reduced motion, print rules, receipt width classes, and institutional tokens are present.
- The current palette is institutionally sober. During chart/status polish, add enough semantic color variety and labels so reports do not rely on a single teal/slate family.
- Avoid broad UI rewrites. Most V1.1 work should harden existing components and critical screens.

## Evidence Still Required

Digital evidence:

- Desktop and mobile screenshots for login, dashboard, POS, payment modal, invoice confirmation, cashbox close, invoice history, reports, backups, fiscal settings, receipt settings, users, help/support, and dark mode.
- Playwright smoke for create invoice, pay, open institutional PDF, reprint from history, close cash session, reports export availability, and role-denied route.
- Axe or Testing Library accessibility checks for POS, payment modal, receipt settings, history actions, and mobile navigation.
- Screenshot or saved PDF for institutional receipt in letter, half-letter, and A5.

Physical evidence not yet claimable:

- Second LAN client reaches server by local IP.
- Printer output tested with real configured printer.
- Backup restore tested in an isolated database.
- LAN concurrent-user/load smoke completed.

## Implementation Order Recommended By Audit

1. Fix P0 fiscal/legal fallback issue before any receipt screenshots.
2. Harden receipt/PDF trust and institutional copy path.
3. Polish POS mobile total/action visibility and long-name wrapping.
4. Polish reports density, charts, and fallback summaries.
5. Improve receipt settings sequence/profile clarity.
6. Run visual, accessibility, and print evidence phases.

## Acceptance Criteria For This Audit Phase

- Every active module has an explicit status and priority.
- P0 issues are identified before implementation.
- Recommendations are scoped to existing files and shared components.
- No product code, backend code, migrations, or dependencies were changed in this phase.
- This document can drive the next committable implementation phase.
