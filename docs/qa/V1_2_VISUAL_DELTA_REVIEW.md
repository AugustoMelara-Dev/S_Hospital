# V1.2 Visual Delta Review

Date: 2026-06-28
Branch: codex/v1-2-visible-ui-delta
Base SHA: d0f48aabcb8e3611808c5b8b130de12aafbc2f98

## Scope

This review covers the visible V1.2 UX/UI refactor for the React frontend. It does not approve physical production deployment and does not certify the LAN server at 192.168.1.10.

## Before Evidence

Before capture was attempted against the known runtime, but the supplied login credentials returned 422, so only the unauthenticated login screen could be captured without mutating or forcing access.

Evidence:
- qa/v1-2-visible-ui-delta/before/login.png
- qa/v1-2-visible-ui-delta/before/BEFORE_SCREENSHOTS.md
- qa/v1-2-visible-ui-delta/before/before-screenshots-report.json

Limitation: authenticated before/after parity is incomplete because no authorized disposable session was available for the old runtime.

## After Evidence

After capture used the mocked non-production production-readiness harness. It generated 34 PNG screenshots plus a JSON report under qa/v1-2-visible-ui-delta/after.

Captured areas include:
- login light/dark
- dashboard light/dark
- billing empty/cart/mobile
- invoice confirmation and payment modal
- receipt preview letter/media/A5/dark
- cashbox open and close dialog
- invoice history
- reports admin/cash/services/dark/mobile
- catalog
- fiscal settings
- receipt settings and preview
- users light/dark
- backups pending
- help/about
- access denied
- 404
- mobile dashboard/billing/reports

Evidence:
- qa/v1-2-visible-ui-delta/after/rc-e2e-mocked-report.json
- qa/v1-2-visible-ui-delta/after/*.png

## Visible Delta Assessment

PASS. The new UI is visibly different from V1.1 in structure, hierarchy, density, and operational polish:
- Shell/navigation: stronger institutional sidebar, topbar state, LAN/cash status, breadcrumbs, and mobile navigation.
- Dashboard: command-center treatment with operational status, primary actions, metrics, charts, next action, top services, and cashiers.
- POS: cashier-station layout with patient capture, dominant service search, cart/total hierarchy, modal payment flow, and clear blocked states.
- Reports: executive header, range controls, chart cards, KPI cards, tabbed sections, and denser professional tables.
- Cash/history: clearer cash status, movement/history tables, status badges, confirmation paths, and reprint/reversal affordances.
- Receipts/settings/catalog/backups/users/auth: formal panels, document preview frame, grouped forms, stronger empty/error states, and admin-grade RBAC UI.

## Issues Found And Fixed During Final QA

- Stale Playwright expectations still looked for the old dashboard H1 `Inicio`; updated to `Centro de mando`.
- Shared `CashStatusCard` rendered helper text directly inside a `dl`; moved helper text outside the definition list.
- POS compact total used `text-secondary` on a tinted secondary panel; changed to contrast-safe foreground text.
- Reports KPI helper text used `text-muted-foreground/80`; changed to standard muted foreground.
- Release RBAC and production-readiness specs had stale users/dashboard selectors; updated to current accessible headings.

## Result

Visual delta: PASS
After evidence: PASS
Before evidence: PARTIAL, credential-limited
Production physical approval: NO
Tag created: NO